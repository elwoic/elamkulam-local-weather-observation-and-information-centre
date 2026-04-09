import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl = document.getElementById("alert-pre");
  const infoEl = document.getElementById("alert-info");
  const timeEl = document.getElementById("alert-timestamp");

  /* 1. START LOADING STATE */
  if (panel) {
    panel.style.display = "block"; // Make sure it's visible
    // We put the loading message inside the manual element area temporarily
    manualEl.innerHTML = `
      <div class="loading-text">
        <span class="blink">●</span> Connecting to database...
      </div>`;
    preEl.textContent = ""; 
    infoEl.textContent = "";
  }

  const firebaseConfig = {
    apiKey: "AIzaSyALWX2l-9_6izgvt_JerJjTDbgNc5oT2VQ",
    authDomain: "administration-protal.firebaseapp.com",
    databaseURL: "https://administration-protal-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "administration-protal",
    storageBucket: "administration-protal.firebasestorage.app",
    messagingSenderId: "141478371424",
    appId: "1:141478371424:web:ab431e8c467084e4fee305"
  };

  const app = getApps().find(a => a.name === "alertsApp") || initializeApp(firebaseConfig, "alertsApp");
  const db = getDatabase(app);
  const reportsQuery = ref(db, "/"); // Adjusted to match your data structure

  function dateOnlyTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

  onValue(reportsQuery, (snapshot) => {
    const data = snapshot.val();
    
    // If database is completely empty, hide and stop
    if (!data) {
      panel.style.display = "none";
      return;
    }

    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let hasManual = false;
    let hasPre = false;
    let hasInfo = false;

    // 2. CLEAR LOADING STATE BEFORE PROCESSING
    manualEl.innerHTML = "";
    manualEl.classList.remove("blink");
    preEl.classList.remove("blink");
    manualEl.style.color = "";
    preEl.style.color = "";

    /* ── MANUAL UPDATE LOGIC ── */
    if (data.manualUpdate) {
      const manualTs = dateOnlyTs(data.manualUpdate.date);
      if (!Number.isNaN(manualTs) && manualTs === todayTs && data.manualUpdate.text) {
        manualEl.textContent = data.manualUpdate.text;
        manualEl.style.color = "red";
        hasManual = true;
        if (data.manualUpdate.blink) manualEl.classList.add("blink");
      }
    }

    /* ── PRE UPDATE LOGIC ── */
    if (data.preUpdate) {
      const preTs = dateOnlyTs(data.preUpdate.date);
      if (!Number.isNaN(preTs) && data.preUpdate.text) {
        if (preTs === todayTs) {
          if (!hasManual) {
            manualEl.textContent = data.preUpdate.text;
            manualEl.style.color = "red";
            hasManual = true;
            if (data.preUpdate.blink) manualEl.classList.add("blink");
          }
        } else if (todayTs < preTs) {
          preEl.textContent = data.preUpdate.text;
          preEl.style.color = "#f1c40f";
          hasPre = true;
          if (data.preUpdate.blink) preEl.classList.add("blink");
        }
      }
    }

    /* ── INFO LOGIC ── */
    if (data.info && data.info.text) {
      infoEl.textContent = data.info.text;
      hasInfo = true;
    }

    /* 3. FINAL VISIBILITY CHECK */
    // If ANY of the three categories have data, show the panel. Otherwise, hide it.
    const shouldShow = hasManual || hasPre || hasInfo;
    panel.style.display = shouldShow ? "block" : "none";

    if (shouldShow && data.lastUpdated) {
      timeEl.textContent = "Last updated: " + data.lastUpdated;
    } else {
      timeEl.textContent = "";
    }
  });
});
