/*
 * Content script — runs INSIDE the real BLS page.
 *
 * Because it executes in the page's own JS context with the user's genuine
 * session cookies, BLS treats it as normal human interaction.
 */

(function () {
  "use strict";

  /* ---------------- helpers ---------------- */

  const log = (...a) => console.debug("[GCR-Bridge]", ...a);

  function setNativeValue(el, value) {
    // React/Vue-safe value setter
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function labelText(el) {
    if (!el) return "";
    const parts = [];
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent || "");
    }
    let p = el.closest("div,li,td,tr,section");
    let guard = 0;
    while (p && guard < 4 && parts.join(" ").trim().length < 3) {
      const lbl = p.querySelector("label,.label,.form-label,legend");
      if (lbl) parts.push(lbl.textContent || "");
      p = p.parentElement;
      guard++;
    }
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    if (el.placeholder) parts.push(el.placeholder);
    if (el.name) parts.push(el.name);
    return parts.join(" ").toLowerCase();
  }

  /** Fuzzy match an input against the target field name. */
  function scoreField(el, target) {
    const t = target.toLowerCase();
    const hay = [
      el.name || "",
      el.id || "",
      labelText(el),
    ].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");

    const targetWords = t.replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);

    let hits = 0;
    for (const w of targetWords) {
      if (w.length < 3) continue;
      if (hay.includes(w)) hits += 1;
    }
    // strong exact id/name match
    if ((el.name || "").toLowerCase().replace(/_/g, "") === t.replace(/_/g, "")) return 100;
    return hits;
  }

  function allInputs() {
    return Array.from(
      document.querySelectorAll(
        "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea",
      ),
    ).filter((el) => !el.disabled && el.offsetParent !== null);
  }

  /* ---------------- SELECT_CONTEXT ---------------- */

  function selectByLabel(keywords, value) {
    if (!value) return false;
    const low = value.toLowerCase();
    for (const el of allInputs()) {
      if (el.tagName !== "SELECT") continue;
      const hay = `${el.name} ${el.id} ${labelText(el)}`.toLowerCase();
      if (!keywords.some((k) => hay.includes(k))) continue;
      for (const opt of Array.from(el.options)) {
        if (opt.text.toLowerCase().trim() === low || opt.value.toLowerCase() === low) {
          setNativeValue(el, opt.value);
          log("selected", keywords.join("/"), "=", opt.value);
          return true;
        }
      }
      // fuzzy by prefix
      const opt = Array.from(el.options).find((o) =>
        o.text.toLowerCase().includes(low.split(" ")[0]),
      );
      if (opt) {
        setNativeValue(el, opt.value);
        return true;
      }
    }
    return false;
  }

  function handleSelectContext(msg) {
    let matched = 0;
    if (msg.bookingType && selectByLabel(["appointment book for", "booking type", "book for"], msg.bookingType)) matched++;
    if (msg.centre && selectByLabel(["centre", "center", "city"], msg.centre)) matched++;
    if (msg.category && selectByLabel(["category", "appointment type", "visa type"], msg.category)) matched++;
    return { matched };
  }

  /* ---------------- slot picking (date + time) ---------------- */

  const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  /** Parse "20 Nov 2026" / "2026-11-20" / "20/11/2026" into a comparable key. */
  function parseDay(text) {
    if (!text) return null;
    const t = text.trim().replace(/\s+/g, " ");
    let m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = t.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
    if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
      return new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
    }
    return null;
  }

  function sameDay(a, b) {
    return (
      a && b && a.getUTCFullYear() === b.getUTCFullYear() &&
      a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
    );
  }

  function timeToMinutes(t) {
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return +m[1] * 60 + +m[2];
  }

  /** Is this element a real bookable day/slot rather than static text? */
  function isBookable(el) {
    if (!el || el.offsetParent === null) return false;
    if (el.disabled) return false;
    if (el.hasAttribute("disabled")) return false;

    const cls = (el.className || "").toString().toLowerCase();
    if (/disabled|blocked|unavailable|full|holiday|closed|notavailable/.test(cls)) return false;

    const aria = (el.getAttribute("aria-disabled") || "").toLowerCase();
    if (aria === "true") return false;

    const style = window.getComputedStyle(el);
    if (style.pointerEvents === "none" || style.visibility === "hidden") return false;

    // must look interactive
    const tag = el.tagName;
    if (tag === "A" || tag === "BUTTON") return true;
    if (tag === "INPUT") return /^(button|submit)$/i.test(el.type || "");
    if (el.onclick || el.getAttribute("onclick")) return true;
    if (/slot|calendar|date|day|available/.test(cls)) return true;
    // clickable table cell / list item carrying a date
    if (tag === "TD" || tag === "LI") return true;
    return false;
  }

  /** Try to advance the calendar to the next month that has availability. */
  function advanceCalendar() {
    const nextLabels = /(^|\s)(next|›|»|>|\u203a)(\s|$)/i;
    const cands = Array.from(
      document.querySelectorAll("a, button, span[onclick], div[onclick]"),
    ).filter((el) => {
      if (el.offsetParent === null) return false;
      const t = (el.textContent || "").trim();
      return nextLabels.test(t) || /next month/i.test(t);
    });
    for (const el of cands) {
      if (/disabled/i.test((el.className || "").toString())) continue;
      el.click();
      return true;
    }
    return false;
  }

  /**
   * Pick a slot: the soonest bookable date, and within it the earliest time.
   * Prefers slots at or after `fromMinutes` when a cutoff is supplied.
   */
  function pickSlot(cutoffMinutes, maxMonths) {
    maxMonths = maxMonths || 3;

    // BLS calendars open on the current month: step forward until a slot exists.
    for (let month = 0; month < maxMonths; month += 1) {
      const result = pickSlotInView(cutoffMinutes);
      if (result.picked) return result;
      if (!advanceCalendar()) break;
    }
    return { picked: null, reason: "no bookable slot found in the calendar" };
  }

  function pickSlotInView(cutoffMinutes) {
    const clickable = Array.from(
      document.querySelectorAll("a, button, input[type=button], input[type=submit], td, li, span"),
    ).filter((el) => {
      if (!isBookable(el)) return false;
      return parseDay(el.textContent || el.value || "") !== null;
    });

    if (!clickable.length) return { picked: null, reason: "no bookable dates in view" };

    // A day cell holds only a date; a slot cell holds date+time (or time only).
    // Group everything under its day so we can pick day first, then time.
    const byDay = new Map();
    for (const el of clickable) {
      const text = (el.textContent || el.value || "").trim();
      const d = parseDay(text);
      if (!d) continue;
      const hasTime = timeToMinutes(text) !== null;
      // For a time-only cell the surrounding day comes from the row header.
      let key = d.toISOString().slice(0, 10);
      if (hasTime && !/\d{1,2}\s+[A-Za-z]{3}/.test(text)) {
        const cell = el.closest("td, li, div");
        const rowDay = cell
          ? parseDay((cell.previousElementSibling?.textContent || "") + "")
          : null;
        if (rowDay) key = rowDay.toISOString().slice(0, 10);
      }
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push({ el, day: d, text, hasTime });
    }

    const days = [...byDay.values()].sort(
      (a, b) => new Date(a[0].day).getTime() - new Date(b[0].day).getTime(),
    );
    if (!days.length) return { picked: null, reason: "no dates" };

    let chosen = null;
    let chosenDay = null;

    for (const group of days) {
      // Case 1: the group is a set of concrete time slots for one day.
      const timed = group.filter((g) => timeToMinutes(g.text) !== null);
      if (timed.length) {
        const sorted = timed.slice().sort((x, y) => {
          const tx = timeToMinutes(x.text);
          const ty = timeToMinutes(y.text);
          // Slots at/after the release minute come first.
          if (cutoffMinutes != null) {
            const fx = tx >= cutoffMinutes ? 0 : 1;
            const fy = ty >= cutoffMinutes ? 0 : 1;
            if (fx !== fy) return fx - fy;
          }
          return tx - ty;
        });
        const best = sorted[0];
        if (!best) continue;
        // Skip a day whose every slot is already in the past.
        if (
          cutoffMinutes != null &&
          timeToMinutes(best.text) < cutoffMinutes
        ) {
          continue;
        }
        chosen = best;
        chosenDay = best.day;
        break;
      }

      // Case 2: only a day cell is present -> click it, the time list loads next.
      const dayCell = group[0];
      if (!dayCell) continue;
      chosen = dayCell;
      chosenDay = dayCell.day;
      break;
    }

    if (!chosen) return { picked: null, reason: "no slot at or after the cutoff" };

    const target = chosen.el;
    target.scrollIntoView({ block: "center" });
    // Some calendars need a real mouse sequence rather than el.click().
    try {
      target.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window }),
      );
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    } catch (e) { /* older browsers */ }
    target.click();

    return {
      picked: chosen.text.slice(0, 60),
      date: chosenDay ? chosenDay.toISOString().slice(0, 10) : null,
    };
  }

  /* ---------------- FILL_FORM ---------------- */

  function fillForm(fields) {
    const inputs = allInputs();
    const used = new Set();
    const unmatched = [];
    let filled = 0;

    for (const [name, value] of Object.entries(fields || {})) {
      if (value === "" || value === null || value === undefined) continue;

      let best = null;
      let bestScore = 0;
      for (const el of inputs) {
        if (used.has(el)) continue;
        const s = scoreField(el, name);
        if (s > bestScore) {
          bestScore = s;
          best = el;
        }
      }

      // require at least one meaningful word matched
      if (!best || bestScore < 1) {
        unmatched.push(name);
        continue;
      }

      used.add(best);

      if (best.tagName === "SELECT") {
        const low = String(value).toLowerCase();
        let opt = Array.from(best.options).find(
          (o) => o.text.toLowerCase().trim() === low || o.value.toLowerCase() === low,
        );
        if (!opt) {
          opt = Array.from(best.options).find((o) =>
            o.text.toLowerCase().includes(low.split(" ")[0]),
          );
        }
        if (opt) {
          setNativeValue(best, opt.value);
          filled++;
        } else {
          unmatched.push(name);
        }
        continue;
      }

      if (best.type === "radio" || best.type === "checkbox") {
        const low = String(value).toLowerCase();
        const group =
          best.type === "radio" && best.name
            ? document.querySelectorAll(`input[type=radio][name="${CSS.escape(best.name)}"]`)
            : [best];
        let hit = false;
        for (const rb of Array.from(group)) {
          const lbl = `${labelText(rb)} ${rb.value}`.toLowerCase();
          const yes = low === "yes" || low === "نعم" || low === "oui";
          const wants = yes
            ? lbl.includes("yes") || lbl.includes("نعم") || lbl.includes("oui")
            : lbl.includes("no") || lbl.includes("لا") || lbl.includes("non");
          if (wants) {
            if (!rb.checked) rb.click();
            hit = true;
            break;
          }
        }
        if (hit) filled++;
        else unmatched.push(name);
        continue;
      }

      setNativeValue(best, value);
      filled++;
    }

    log("filled", filled, "unmatched", unmatched);
    return { filled, unmatched };
  }

  /* ---------------- SUBMIT ---------------- */

  function findSubmit() {
    const preferred = [
      'input[type=submit]',
      'button[type=submit]',
      "#submit",
      ".submit",
      "button.btn-primary",
    ];
    for (const sel of preferred) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null && !/cancel|back|danger/i.test(el.textContent || "")) {
        return el;
      }
    }
    // any button mentioning submit/book/confirm
    const buttons = Array.from(document.querySelectorAll("button, input[type=button], a.btn"));
    return (
      buttons.find((b) =>
        /submit|book appointment|confirm|réserver|تأكيد|احجز/i.test(
          (b.textContent || b.value || ""),
        ),
      ) || null
    );
  }

  function handleSubmit() {
    const btn = findSubmit();
    if (!btn) return { clicked: false, message: "submit button not found" };
    btn.click();
    return { clicked: true };
  }

  /* ---------------- PICK_SLOT ---------------- */

  function handlePickSlot(msg) {
    return pickSlot(msg.cutoffMinutes);
  }

  /* ---------------- FILL_CAPTCHA ---------------- */

  function handleFillCaptcha(msg) {
    const value = String(msg.solution || "").trim();
    if (!value) return { filled: false, reason: "empty solution" };

    const sels = [
      "input[name*='captcha' i]",
      "input[id*='captcha' i]",
      "input[placeholder*='captcha' i]",
      "#captcha",
      ".captcha input",
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        setNativeValue(el, value);
        return { filled: true };
      }
    }
    return { filled: false, reason: "captcha input not found" };
  }

  /* ---------------- READ_RESULT ---------------- */

  function handleReadResult() {
    const txt = document.body.innerText || "";

    const confMatch =
      txt.match(/(?:reference|appointment (?:no|number)|confirmation)\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9-]{6,})/i) ||
      txt.match(/\b([A-Z]{4}-[A-Z]{4})\b/);

    const dateMatch = txt.match(/\b(\d{2,4}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/);
    const timeMatch = txt.match(/\b([0-2]?\d:[0-5]\d)\s*(am|pm)?\b/i);

    const success =
      /appointment (is )?(confirmed|booked|successful)|rendez-vous (confirm|réservé)|تم الحجز|مؤكّد/i.test(
        txt,
      );

    if (confMatch) {
      return {
        confirmation: confMatch[1],
        appointmentDate: dateMatch ? dateMatch[1] : null,
        appointmentTime: timeMatch ? timeMatch[0] : null,
        success,
      };
    }
    return { confirmation: null, success, message: "no confirmation yet" };
  }

  /* ---------------- CAPTCHA ---------------- */

  function handleCaptcha() {
    // common captcha containers / image patterns on appointment portals
    const sels = [
      "img[src*='captcha' i]",
      "img[id*='captcha' i]",
      "img[class*='captcha' i]",
      "#captchaImage",
      ".captcha-image img",
      "img[src^='data:image']",
    ];
    for (const sel of sels) {
      const img = document.querySelector(sel);
      if (img && img.offsetParent !== null && img.naturalWidth > 20) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          return { imageDataUrl: canvas.toDataURL("image/png") };
        } catch (e) {
          return { imageDataUrl: img.src };
        }
      }
    }
    return { imageDataUrl: null };
  }

  /* ---------------- DIAGNOSE ---------------- */

  function handleDiagnose() {
    const bookable = Array.from(
      document.querySelectorAll("a, button, input[type=button], input[type=submit], td, li, span"),
    ).filter((el) => {
      if (!isBookable(el)) return false;
      return parseDay(el.textContent || el.value || "") !== null;
    });

    const all = Array.from(document.querySelectorAll("a, button, td, li, span"));
    const dateCells = all.filter(
      (el) => el.offsetParent !== null && parseDay(el.textContent || el.value || "") !== null,
    );
    const timeSlots = all.filter(
      (el) => el.offsetParent !== null && timeToMinutes(el.textContent || el.value || "") !== null,
    );
    const disabled = all.filter(
      (el) =>
        el.offsetParent !== null &&
        /disabled|blocked|unavailable|full/i.test(
          (el.className || "").toString() + " " + (el.getAttribute("aria-disabled") || ""),
        ),
    );

    const hasNext = Array.from(
      document.querySelectorAll("a, button, span[onclick], div[onclick]"),
    ).some((el) => {
      if (el.offsetParent === null) return false;
      const t = (el.textContent || "").trim();
      return /(^|\s)(next|›|»|>|\u203a)(\s|$)/i.test(t) || /next month/i.test(t);
    });

    const captchaImg =
      document.querySelector(
        "img[src*='captcha' i], img[id*='captcha' i], img[class*='captcha' i]",
      ) !== null;
    const captchaInput =
      document.querySelector(
        "input[name*='captcha' i], input[id*='captcha' i], input[placeholder*='captcha' i]",
      ) !== null;

    return {
      url: location.href,
      bookable: bookable.length,
      dateCells: dateCells.length,
      timeSlots: timeSlots.length,
      disabled: disabled.length,
      hasNext,
      inputs: document.querySelectorAll("input:not([type=hidden])").length,
      selects: document.querySelectorAll("select").length,
      captcha: captchaImg,
      captchaInput,
      samples: bookable.slice(0, 6).map((e) => (e.textContent || e.value || "").trim().slice(0, 40)),
    };
  }

  /* ---------------- message router ---------------- */

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    switch (msg.type) {
      case "SELECT_CONTEXT":
        reply(handleSelectContext(msg));
        return true;
      case "FILL_FORM":
        reply(fillForm(msg.fields));
        return true;
      case "SUBMIT":
        reply(handleSubmit());
        return true;
      case "READ_RESULT":
        reply(handleReadResult());
        return true;
      case "CAPTCHA":
        reply(handleCaptcha());
        return true;
      case "PICK_SLOT":
        reply(handlePickSlot(msg));
        return true;
      case "FILL_CAPTCHA":
        reply(handleFillCaptcha(msg));
        return true;
      case "PING":
        reply({ ok: true, url: location.href });
        return true;
      case "DIAGNOSE":
        reply(handleDiagnose());
        return true;
      default:
        reply(null);
        return false;
    }
  });

  // tell the background we are alive on a BLS page
  chrome.runtime.sendMessage({ type: "MARK_SESSION" }).catch(() => {});
  log("content script ready on", location.href);
})();