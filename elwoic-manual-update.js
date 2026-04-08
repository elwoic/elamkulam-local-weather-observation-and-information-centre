import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {

  const firebaseConfig = {
    apiKey: "AIzaSyALWX2l-9_6izgvt_JerJjTDbgNc5oT2VQ",
    authDomain: "administration-protal.firebaseapp.com",
    databaseURL: "https://administration-protal-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "administration-protal",
    storageBucket: "administration-protal.firebasestorage.app",
    messagingSenderId: "141478371424",
    appId: "1:141478371424:web:ab431e8c467084e4fee305"
  };

  const app =
    getApps().find(a => a.name === "alertsApp") ||
    initializeApp(firebaseConfig, "alertsApp");

  const db = getDatabase(app);

  /* ---------- DOM ---------- */
  const panel = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl = document.getElementById("alert-pre");
  const infoEl = document.getElementById("alert-info");
  const timeEl = document.getElementById("alert-timestamp");

  panel.style.display = "none";

  /* ---------- HELPERS ---------- */
  function dateOnlyTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

  onValue(ref(db, "/"), (snapshot) => {
    const data = snapshot.val() || {};
    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let hasManual = false;
    let hasPre = false;
    let hasInfo = false;

    // 1. Reset States
    const resetElement = (el) => {
        el.classList.remove("blink", "alert-default");
        el.style.color = "";
        el.textContent = ""; 
    };

    [manualEl, preEl, infoEl].forEach(resetElement);

    /* ---------- MANUAL ---------- */
    // Logic: Show if date is TODAY
    if (data.manualUpdate?.text && data.manualUpdate?.date) {
        const manualTs = dateOnlyTs(data.manualUpdate.date);
        if (manualTs === todayTs) {
            manualEl.textContent = data.manualUpdate.text;
            manualEl.style.color = "red";
            hasManual = true;
            if (data.manualUpdate.blink) manualEl.classList.add("blink");
        }
    }

    /* ---------- PRE UPDATE ---------- */
    // Logic: Show only if the target date is in the FUTURE
    if (data.preUpdate?.text && data.preUpdate?.date) {
        const preTs = dateOnlyTs(data.preUpdate.date);
        if (todayTs < preTs) {
            preEl.textContent = data.preUpdate.text;
            preEl.style.color = "#f1c40f"; // Amber/Yellow
            hasPre = true;
            if (data.preUpdate.blink) preEl.classList.add("blink");
        }
    }

    /* ---------- INFO ---------- */
    if (data.info?.text) {
        infoEl.textContent = data.info.text;
        hasInfo = true;
    }

    // 2. Final Visibility Toggle
    // If an alert is active, show the panel. Otherwise, hide it.
    const shouldShowPanel = hasManual || hasPre || hasInfo;
    panel.style.display = shouldShowPanel ? "block" : "none";

    if (shouldShowPanel && data.lastUpdated) {
        timeEl.textContent = "Last updated: " + data.lastUpdated;
    }
});
});
