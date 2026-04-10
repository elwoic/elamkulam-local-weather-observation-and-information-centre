import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl = document.getElementById("alert-pre");
  const infoEl = document.getElementById("alert-info");
  const timeEl = document.getElementById("alert-timestamp");

  /* 1. START UNIVERSAL LOADING STATE */
  /* 1. START UNIVERSAL LOADING STATE */
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
  manualEl.innerHTML = loadingHtml;
  preEl.innerHTML = loadingHtml;
  infoEl.innerHTML = loadingHtml;
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
  const reportsQuery = ref(db, "/");

  function dateOnlyTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

 onValue(reportsQuery, (snapshot) => {
  const data = snapshot.val();
  
  // 1. Instantly clear the spinners
  [manualEl, preEl, infoEl].forEach(el => {
    el.innerHTML = ""; 
    el.classList.remove("blink");
    el.style.color = "";
  });

  // 2. Set the "Default" text (this shows if data is missing or expired)
  manualEl.textContent = "No updates available at this time";
  preEl.textContent = "No updates scheduled";
  infoEl.textContent = "No general information";

  if (!data) return;

  const now = new Date();
  const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let hasActualManual = false;

  // 3. Process Manual Updates
  if (data.manualUpdate) {
    const manualTs = dateOnlyTs(data.manualUpdate.date);
    if (!Number.isNaN(manualTs) && manualTs === todayTs && data.manualUpdate.text) {
      manualEl.textContent = data.manualUpdate.text;
      manualEl.style.color = "red";
      hasActualManual = true;
      if (data.manualUpdate.blink) manualEl.classList.add("blink");
    }
  }

  // 4. Process Pre-Updates
  if (data.preUpdate) {
    const preTs = dateOnlyTs(data.preUpdate.date);
    if (!Number.isNaN(preTs) && data.preUpdate.text) {
      if (preTs === todayTs && !hasActualManual) {
          manualEl.textContent = data.preUpdate.text;
          manualEl.style.color = "red";
          if (data.preUpdate.blink) manualEl.classList.add("blink");
      } else if (todayTs < preTs) {
          preEl.textContent = data.preUpdate.text;
          preEl.style.color = "#f1c40f";
          if (data.preUpdate.blink) preEl.classList.add("blink");
      }
    }
  }

  // 5. Process Info
  if (data.info && data.info.text) {
    infoEl.textContent = data.info.text;
  }

  // 6. Timestamp
  timeEl.textContent = data.lastUpdated ? "Last updated: " + data.lastUpdated : "";
});
});
