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

  onValue(ref(db, "/"), (snap) => {
    const data = snap.val();
    if (!data) {
      panel.style.display = "none";
      return;
    }

    const today = new Date();
    const todayTs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

    let hasContent = false;

    // reset
    [manualEl, preEl, infoEl].forEach(el => {
      el.textContent = "";
      el.className = "alert-line";
      el.style.display = "none";
    });

    /* MANUAL */
    const manualTs = dateTs(data.manualUpdate?.date);
    if (data.manualUpdate?.text && manualTs === todayTs) {
      manualEl.textContent = data.manualUpdate.text;
      manualEl.classList.add("alert-red");
      if (data.manualUpdate.blink) manualEl.classList.add("blink");
      manualEl.style.display = "block";
      hasContent = true;
    }

    /* PRE */
    const preTs = dateTs(data.preUpdate?.date);
    if (data.preUpdate?.text && todayTs < preTs) {
      preEl.textContent = data.preUpdate.text;
      preEl.classList.add("alert-yellow");
      if (data.preUpdate.blink) preEl.classList.add("blink");
      preEl.style.display = "block";
      hasContent = true;
    }

    /* INFO */
    if (data.info?.text) {
      infoEl.textContent = data.info.text;
      infoEl.style.display = "block";
      hasContent = true;
    }

    if (data.lastUpdated) {
      timeEl.textContent = `Last updated: ${data.lastUpdated}`;
    }

    panel.style.display = hasContent ? "block" : "none";
  });
});
