import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const panel    = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl    = document.getElementById("alert-pre");
  const infoEl   = document.getElementById("alert-info");
  const timeEl   = document.getElementById("alert-timestamp");

  /* ── LOADING STATE ── */
  const loadingHtml = `
    <div class="loading-text">
      <div class="spinner-wrapper">
        <div class="spinner-ring"></div>
        <div class="spinner-dot"></div>
      </div>
      <span>Connecting to database...</span>
    </div>`;

  if (panel) {
    panel.style.display = "block";
    if (manualEl) manualEl.innerHTML = loadingHtml;
    if (preEl)    preEl.innerHTML    = loadingHtml;
    if (infoEl)   infoEl.innerHTML   = loadingHtml;
  }

  const firebaseConfig = {
    apiKey:            "AIzaSyALWX2l-9_6izgvt_JerJjTDbgNc5oT2VQ",
    authDomain:        "administration-protal.firebaseapp.com",
    databaseURL:       "https://administration-protal-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "administration-protal",
    storageBucket:     "administration-protal.firebasestorage.app",
    messagingSenderId: "141478371424",
    appId:             "1:141478371424:web:ab431e8c467084e4fee305"
  };

  const app = getApps().find(a => a.name === "alertsApp") || initializeApp(firebaseConfig, "alertsApp");
  const db  = getDatabase(app);

  /* ── DATE HELPER ── */
  function parseDateTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  onValue(ref(db, "/"), (snapshot) => {
    const data = snapshot.val();

    /* Reset all elements */
    [manualEl, preEl, infoEl].forEach(el => {
      if (!el) return;
      el.innerHTML = "";
      el.classList.remove("blink");
      el.style.color = "";
    });
    if (timeEl) timeEl.textContent = "";

    /* Today at midnight for clean date comparison */
    const now = new Date();
    const tTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    /* Individual fill flags — each field is fully independent */
    let manualFilled = false;
    let preFilled    = false;
    let infoFilled   = false;

    /* ── MANUAL UPDATE ──
       Rules:
       - If date is today or future (or no date set) → show
       - If date is past → expired, skip
    */
    if (data?.manualUpdate?.text) {
      const manualTs  = parseDateTs(data.manualUpdate.date);
      const isValid   = isNaN(manualTs) || manualTs >= tTs; // no date = always valid
      if (isValid && manualEl) {
        manualEl.textContent = data.manualUpdate.text;
        manualEl.style.color = "red";
        if (data.manualUpdate.blink === true || data.manualUpdate.blink === "true")
          manualEl.classList.add("blink");
        manualFilled = true;
      }
    }

    /* ── PRE-UPDATE ──
       Rules:
       - Future date → show in pre section
       - Today's date → promote to manual/current section (only if manual not already filled)
       - Past date → expired, skip
    */
    if (data?.preUpdate?.text) {
      const preTs = parseDateTs(data.preUpdate.date);

      if (!isNaN(preTs) && preTs === tTs && !manualFilled) {
        /* Target date is today — promote to current update slot */
        if (manualEl) {
          manualEl.textContent = data.preUpdate.text;
          manualEl.style.color = "red";
          if (data.preUpdate.blink === true || data.preUpdate.blink === "true")
            manualEl.classList.add("blink");
          manualFilled = true;
          /* Pre section gets a note that it has been promoted */
          if (preEl) {
            preEl.textContent   = "This update has been promoted to Current Update today.";
            preEl.style.color   = "#f1c40f";
            preFilled = true;
          }
        }
      } else if (!isNaN(preTs) && preTs > tTs) {
        /* Future — show in pre section normally */
        if (preEl) {
          preEl.textContent = data.preUpdate.text;
          preEl.style.color = "#f1c40f";
          if (data.preUpdate.blink === true || data.preUpdate.blink === "true")
            preEl.classList.add("blink");
          preFilled = true;
        }
      }
      /* Past date → expired, both flags stay false */
    }

    /* ── INFO ── */
    if (data?.info?.text && infoEl) {
      infoEl.textContent = data.info.text;
      infoFilled = true;
    }

    /* ── DEFAULT TEXT — every field independently ── */
    if (!manualFilled && manualEl) manualEl.textContent = "No updates available at this time";
    if (!preFilled    && preEl)    preEl.textContent    = "No updates scheduled";
    if (!infoFilled   && infoEl)   infoEl.textContent   = "No general information";

    /* ── TIMESTAMP ── */
    if (timeEl && data?.lastUpdated) {
      timeEl.textContent = "Last updated: " + data.lastUpdated;
    }

    /* ── PANEL VISIBILITY ──
       Hide entire panel only when ALL three fields have no real data */
    const hasAny = manualFilled || preFilled || infoFilled;
    if (panel) panel.style.display = hasAny ? "block" : "none";
  });
});
