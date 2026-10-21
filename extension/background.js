/*
 * Golden Crown BLS Bridge — background service worker.
 *
 * Polls the website for queued tasks and executes them inside a real,
 * logged-in Chrome tab. Genuine cookies + genuine fingerprint = no bot block.
 */

const DEFAULT_SERVER = "http://localhost:3000";
const POLL_MS = 700;          // aggressive but polite
const MAX_TASKS_PER_POLL = 12;

const state = {
  server: DEFAULT_SERVER,
  pairCode: "",
  extensionId: "",
  running: false,
  sessionReady: false,
  bookingUrl: "",
  lastTasks: [],
  lastError: "",
  lastPollAt: 0,
  stats: { polls: 0, dispatched: 0, done: 0, failed: 0 },
};

/* ---------------------------------------------------------------- */
/* pairing code                                                      */
/* ---------------------------------------------------------------- */

function makeExtensionId() {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(rnd, (n) => n.toString(16)).join("").toUpperCase().slice(0, 8);
}

async function init() {
  const stored = await chrome.storage.local.get([
    "server", "pairCode", "extensionId", "running",
  ]);
  state.server = stored.server || DEFAULT_SERVER;
  state.pairCode = stored.pairCode || "";
  state.extensionId = stored.extensionId || makeExtensionId();
  state.running = stored.running !== false;
  await chrome.storage.local.set({ extensionId: state.extensionId });

  chrome.alarms.create("poll", { periodInMinutes: 0.02 }); // ~1.2s floor
  chrome.alarms.onAlarm.addListener(onAlarm);
  await onAlarm();
}

async function onAlarm(alarm) {
  if (!alarm || alarm.name === "poll") {
    if (state.running && state.pairCode) await poll();
  }
}

async function saveSettings(patch) {
  Object.assign(state, patch);
  await chrome.storage.local.set(patch);
}

/* ---------------------------------------------------------------- */
/* polling                                                           */
/* ---------------------------------------------------------------- */

async function poll() {
  if (!state.running || !state.pairCode) return;

  try {
    state.lastPollAt = Date.now();
    state.stats.polls++;

    const res = await fetch(`${state.server}/api/bridge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: state.pairCode,
        extensionId: state.extensionId,
        browserLabel: navigator.userAgent.slice(0, 90),
        sessionReady: state.sessionReady,
        bookingUrl: state.bookingUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      state.lastError =
        body.error === "UNKNOWN_CHANNEL"
          ? "Pairing code not recognised on the server."
          : body.error === "BAD_PAIR_CODE"
            ? "Invalid pairing code."
            : `HTTP ${res.status}`;
      if (body.error === "UNKNOWN_CHANNEL") state.running = false;
      await persist();
      return;
    }

    const data = await res.json();
    state.lastError = "";

    if (Array.isArray(data.tasks) && data.tasks.length) {
      state.stats.dispatched += data.tasks.length;
      state.lastTasks = data.tasks.map((t) => ({
        id: t.id,
        kind: t.kind,
        runId: t.runId,
        at: Date.now(),
      }));

      // execute sequentially to keep the tab state coherent
      for (const task of data.tasks.slice(0, MAX_TASKS_PER_POLL)) {
        await execute(task);
      }
    }

    await persist();
  } catch (err) {
    state.lastError = String(err.message || err);
    await persist();
  }
}

async function persist() {
  await chrome.storage.local.set({
    server: state.server,
    pairCode: state.pairCode,
    extensionId: state.extensionId,
    running: state.running,
    sessionReady: state.sessionReady,
    bookingUrl: state.bookingUrl,
    lastError: state.lastError,
    lastTasks: state.lastTasks,
    lastPollAt: state.lastPollAt,
    stats: state.stats,
  });

  // keep the popup in sync
  chrome.runtime.sendMessage({ type: "STATE", state }).catch(() => {});
}

async function report(taskId, ok, result = {}) {
  try {
    await fetch(`${state.server}/api/bridge`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairCode: state.pairCode, taskId, ok, result }),
    });
    if (ok) state.stats.done++;
    else state.stats.failed++;
  } catch {
    /* the next poll will retry naturally */
  }
}

/* ---------------------------------------------------------------- */
/* task execution                                                    */
/* ---------------------------------------------------------------- */

function findOrOpenTab(url) {
  return new Promise(async (resolve) => {
    const target = url || "https://algeria.blsspainvisa.com/";
    const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { url: target, active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
      resolve(tabs[0]);
    } else {
      const tab = await chrome.tabs.create({ url: target, active: true });
      resolve(tab);
    }
  });
}

function waitForLoad(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => {
      if (t && t.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    }).catch(() => resolve(false));
  });
}

function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message).catch(() => null);
}

async function execute(task) {
  const { id, kind, payload = {} } = task;

  try {
    switch (kind) {
      case "PING": {
        state.sessionReady = true;
        state.bookingUrl = payload.url || state.bookingUrl;
        await report(id, true, { pong: true, warm: Boolean(payload.warm) });
        break;
      }

      case "OPEN_BOOKING": {
        const tab = await findOrOpenTab(payload.url);
        await waitForLoad(tab.id);
        state.sessionReady = true;
        state.bookingUrl = payload.url;
        // let the content script map the centre/category selectors
        await sleep(1200);
        const r = await sendToTab(tab.id, {
          type: "SELECT_CONTEXT",
          centre: payload.centre,
          category: payload.category,
          bookingType: payload.bookingType,
        });
        await report(id, true, { tabId: tab.id, matched: r?.matched ?? 0 });
        break;
      }

      case "FILL_FORM": {
        const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
        if (!tabs.length) {
          await report(id, false, { error: "BLS tab not open" });
          break;
        }
        const r = await sendToTab(tabs[0].id, {
          type: "FILL_FORM",
          fields: payload.fields,
        });
        state.sessionReady = true;
        await report(id, true, { filled: r?.filled ?? 0, unmatched: r?.unmatched ?? [] });
        break;
      }

      case "PICK_SLOT": {
        const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
        if (!tabs.length) {
          await report(id, false, { error: "BLS tab not open" });
          break;
        }
        // The calendar may need a moment after the form step.
        await sleep(1200);

        // Try repeatedly: clicking a day usually reveals the time list, so a
        // second pass is needed to land on an actual HH:MM slot.
        let r = null;
        for (let pass = 0; pass < 4; pass += 1) {
          r = await sendToTab(tabs[0].id, {
            type: "PICK_SLOT",
            cutoffMinutes: payload.cutoffMinutes,
          });
          if (r?.picked) break;
          await sleep(900);
        }

        if (r?.picked) {
          await sleep(700); // let the time panel settle
          await report(id, true, { picked: r.picked, date: r.date });
          notify("📅 Slot selected", `${r.picked}`);
        } else {
          await report(id, false, { error: r?.reason || "no slot available" });
        }
        break;
      }

      case "FILL_CAPTCHA": {
        const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
        if (!tabs.length) {
          await report(id, false, { error: "BLS tab not open" });
          break;
        }
        const r = await sendToTab(tabs[0].id, {
          type: "FILL_CAPTCHA",
          solution: payload.solution,
        });
        await report(id, Boolean(r?.filled), r || {});
        break;
      }

      case "SUBMIT": {
        const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
        if (!tabs.length) {
          await report(id, false, { error: "BLS tab not open" });
          break;
        }
        await sleep(400);
        const r = await sendToTab(tabs[0].id, { type: "SUBMIT" });
        await sleep(2600);
        const conf = await sendToTab(tabs[0].id, { type: "READ_RESULT" });

        if (conf?.confirmation) {
          await report(id, true, {
            confirmation: conf.confirmation,
            appointmentDate: conf.appointmentDate,
            appointmentTime: conf.appointmentTime,
          });
          notify("✅ Booking confirmed", conf.confirmation);
        } else {
          await report(id, false, {
            error: conf?.message || "no confirmation detected yet",
          });
        }
        break;
      }

      case "READ_CAPTCHA": {
        const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
        if (!tabs.length) {
          await report(id, false, { error: "BLS tab not open" });
          break;
        }
        const r = await sendToTab(tabs[0].id, { type: "CAPTCHA" });
        if (r?.imageDataUrl) {
          await report(id, true, { imageDataUrl: r.imageDataUrl });
          notify("🔐 Captcha captured", "Solve it in the operator console");
        } else {
          await report(id, false, { error: "no captcha on page" });
        }
        break;
      }

      default:
        await report(id, false, { error: `unknown task ${kind}` });
    }
  } catch (err) {
    await report(id, false, { error: String(err.message || err) });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}

/* ---------------------------------------------------------------- */
/* popup messages                                                   */
/* ---------------------------------------------------------------- */

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "GET_STATE") {
    reply({ ...state });
    return true;
  }
  if (msg.type === "SET_PAIR") {
    saveSettings({ pairCode: (msg.pairCode || "").toUpperCase().trim() }).then(() => poll()).then(() =>
      reply({ ...state }),
    );
    return true;
  }
  if (msg.type === "SET_SERVER") {
    saveSettings({ server: (msg.server || DEFAULT_SERVER).replace(/\/+$/, "") }).then(() =>
      reply({ ...state }),
    );
    return true;
  }
  if (msg.type === "TOGGLE") {
    saveSettings({ running: !state.running }).then(() => poll()).then(() => reply({ ...state }));
    return true;
  }
  if (msg.type === "PING_NOW") {
    poll().then(() => reply({ ...state }));
    return true;
  }
  if (msg.type === "MARK_SESSION") {
    saveSettings({ sessionReady: true }).then(() => reply({ ...state }));
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
init();