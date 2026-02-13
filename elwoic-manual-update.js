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

  // 🔥 Listen only to public paths
  onValue(ref(db, "manualUpdate"), snapshot => {
    handleManual(snapshot.val());
  });

  onValue(ref(db, "preUpdate"), snapshot => {
    handlePre(snapshot.val());
  });

  onValue(ref(db, "info"), snapshot => {
    handleInfo(snapshot.val());
  });

  onValue(ref(db, "lastUpdated"), snapshot => {
    if (snapshot.exists()) {
      timeEl.textContent = "Last updated: " + snapshot.val();
    }
  });

});
