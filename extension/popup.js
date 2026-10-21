/* Popup controller */

const $ = (id) => document.getElementById(id);

function render(s) {
  $("server").value = s.server || "";
  $("pairCode").value = s.pairCode || "";
  $("toggle").textContent = s.running ? "Pause" : "Resume";

  const dot = $("dot");
  const text = $("statusText");

  if (s.lastError) {
    dot.className = "dot err";
    text.textContent = s.lastError;
  } else if (s.running && s.pairCode) {
    dot.className = "dot on";
    text.textContent = s.sessionReady ? "Connected · BLS session ready" : "Connected · waiting for BLS tab";
  } else if (s.pairCode) {
    dot.className = "dot off";
    text.textContent = "Paused";
  } else {
    dot.className = "dot off";
    text.textContent = "Not paired";
  }

  if (s.lastPollAt) {
    const secs = Math.round((Date.now() - s.lastPollAt) / 1000);
    $("pollAge").textContent = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;
  }

  $("sPoll").textContent = s.stats?.polls ?? 0;
  $("sTask").textContent = s.stats?.dispatched ?? 0;
  $("sDone").textContent = s.stats?.done ?? 0;
  $("sFail").textContent = s.stats?.failed ?? 0;

  const log = $("log");
  const tasks = s.lastTasks || [];
  log.innerHTML = tasks.length
    ? tasks
        .slice()
        .reverse()
        .map(
          (t) =>
            `<div>${new Date(t.at).toLocaleTimeString()} · ${t.kind}${t.runId ? ` #${t.runId}` : ""}</div>`,
        )
        .join("")
    : `<div style="color:#64748b">No tasks dispatched yet.</div>`;
}

async function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

async function refresh() {
  const s = await send({ type: "GET_STATE" });
  render(s || {});
}

$("save").addEventListener("click", async () => {
  await send({ type: "SET_SERVER", server: $("server").value.trim() });
  await send({ type: "SET_PAIR", pairCode: $("pairCode").value });
  await refresh();
});

$("toggle").addEventListener("click", async () => {
  await send({ type: "TOGGLE" });
  await refresh();
});

$("server").addEventListener("change", () => send({ type: "SET_SERVER", server: $("server").value.trim() }));
$("pairCode").addEventListener("change", () =>
  send({ type: "SET_PAIR", pairCode: $("pairCode").value }),
);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STATE") render(msg.state);
});

/* ---- diagnostics ---- */

$("openBLS").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://algeria.blsspainvisa.com/", active: true });
});

$("diag").addEventListener("click", async () => {
  const log = $("log");
  log.innerHTML = '<div style="color:#94a3b8">Scanning…</div>';
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.blsspainvisa.com/*" });
    if (!tabs.length) {
      log.innerHTML =
        '<div class="err-text">No BLS tab open. Open algeria.blsspainvisa.com and log in.</div>';
      return;
    }
    const r = await chrome.tabs
      .sendMessage(tabs[0].id, { type: "DIAGNOSE" })
      .catch(() => null);

    if (!r) {
      log.innerHTML =
        '<div class="err-text">Content script not loaded — reload the BLS tab.</div>';
      return;
    }
    log.innerHTML = [
      `URL        : ${r.url}`,
      `Bookable   : ${r.bookable}`,
      `Date cells : ${r.dateCells}`,
      `Time slots : ${r.timeSlots}`,
      `Disabled   : ${r.disabled}`,
      `Next arrow : ${r.hasNext}`,
      `Inputs     : ${r.inputs}`,
      `Selects    : ${r.selects}`,
      `Captcha img: ${r.captcha}`,
      `Captcha in : ${r.captchaInput}`,
      "",
      "<div style='color:#94a3b8'>Bookable samples:</div>",
      ...(r.samples || []).map((s) => `<div>· ${s}</div>`),
    ].join("");
  } catch (e) {
    log.innerHTML = `<div class="err-text">${String(e.message || e)}</div>`;
  }
});

refresh();
setInterval(refresh, 2000);