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

  const panel = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl = document.getElementById("alert-pre");
  const infoEl = document.getElementById("alert-info");
  const timeEl = document.getElementById("alert-timestamp");

  panel.style.display = "none";

  function dateTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(n => parseInt(n, 10));
    return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  }

  onValue(ref(dbManual, "/"), (snapshot) => {
  const data = snapshot.val() || {};
  const now = new Date();
  const todayTs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  // Flags
  let hasManual = false;
  let hasPre = false;
  let hasInfo = false;

  // Reset
  manualDiv.classList.remove("blink");
  preDiv.classList.remove("blink");

  manualDiv.style.color = "";
  preDiv.style.color = "";

  manualDiv.textContent = "No manual update available.";
  preDiv.textContent = "No pre-update scheduled.";
  infoDiv.textContent = "No additional information.";

  const manualTs = dateOnlyTimestampFromDMY(data.manualUpdate?.date);
  const preTs = dateOnlyTimestampFromDMY(data.preUpdate?.date);

  /* -------- MANUAL (TODAY) -------- */
  if (
    data.manualUpdate &&
    !Number.isNaN(manualTs) &&
    manualTs === todayTs &&
    data.manualUpdate.text
  ) {
    manualDiv.textContent = data.manualUpdate.text;
    manualDiv.style.color = "red";
    hasManual = true;

    if (data.manualUpdate.blink) {
      manualDiv.classList.add("blink");
    }
  }

  /* -------- PRE UPDATE (FUTURE) -------- */
  if (
    data.preUpdate &&
    !Number.isNaN(preTs) &&
    todayTs < preTs &&
    data.preUpdate.text
  ) {
    preDiv.textContent = data.preUpdate.text;
    preDiv.style.color = "#f1c40f";
    hasPre = true;

    if (data.preUpdate.blink) {
      preDiv.classList.add("blink");
    }
  }

  /* -------- INFO -------- */
  if (data.info?.text) {
    infoDiv.textContent = data.info.text;
    hasInfo = true;
  }

  /* -------- VISIBILITY CONTROL -------- */
  const shouldShowPanel = hasManual || hasPre || hasInfo;
  alertsPanel.style.display = shouldShowPanel ? "block" : "none";

  /* -------- TIMESTAMP -------- */
  if (shouldShowPanel && data.lastUpdated) {
    timestampDiv.textContent = "Last updated: " + data.lastUpdated;
  } else {
    timestampDiv.textContent = "";
  }
});
});
