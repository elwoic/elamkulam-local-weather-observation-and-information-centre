import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyALWX2l-9_6izgvt_JerJjTDbgNc5oT2VQ",
  authDomain: "administration-protal.firebaseapp.com",
  databaseURL: "https://administration-protal-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "administration-protal",
  storageBucket: "administration-protal.firebasestorage.app",
  messagingSenderId: "141478371424",
  appId: "1:141478371424:web:ab431e8c467084e4fee305"
};

// Initialize with a unique name 'manualApp'
const appManual = getApps().find(a => a.name === "manualApp") || initializeApp(firebaseConfig, "manualApp");
const db = getDatabase(appManual);

// ... rest of your manual update logic stays exactly the same ...
/* 2️⃣ CREATE OR REUSE NAMED APP */
const app =
  getApps().find(a => a.name === "manualApp")
  ?? initializeApp(firebaseConfig, "manualApp");

/* 3️⃣ DATABASE FROM THAT APP */
const db = getDatabase(app);

/* DEBUG (optional, remove later) */
console.log("Manual apps:", getApps().map(a => a.name));

/* ---------- YOUR EXISTING LOGIC CONTINUES ---------- */

function dateOnlyTimestampFromDMY(ddmmyyyy) {
  if (!ddmmyyyy) return NaN;
  const [d, m, y] = ddmmyyyy.split("/").map(Number);
  return new Date(y, m - 1, d).setHours(0, 0, 0, 0);
}

const manualDiv = document.getElementById("weather-message");
const preDiv = document.getElementById("preupdate-message");
const infoDiv = document.getElementById("info-message");
const manualSection = document.getElementById("manual-update");

const timestampDiv = document.createElement("div");
timestampDiv.style.fontSize = "0.7rem";
timestampDiv.style.color = "#888";
timestampDiv.style.marginTop = "10px";
manualSection.appendChild(timestampDiv);

onValue(ref(db, "/"), (snapshot) => {
  const data = snapshot.val() || {};
  const todayTs = new Date().setHours(0,0,0,0);

  manualDiv.textContent = "No update provided.";
  preDiv.textContent = "No pre-update scheduled.";
  infoDiv.textContent = "No additional info.";

  const manualTs = dateOnlyTimestampFromDMY(data.manualUpdate?.date);
  const preTs = dateOnlyTimestampFromDMY(data.preUpdate?.date);

  if (data.manualUpdate && todayTs === manualTs) {
    manualDiv.textContent = data.manualUpdate.text;
  } else if (data.preUpdate && todayTs === preTs) {
    manualDiv.textContent = data.preUpdate.text;
  }

  if (data.preUpdate && todayTs < preTs) {
    preDiv.textContent = data.preUpdate.text;
  }

  if (data.info?.text) infoDiv.textContent = data.info.text;

  manualSection.style.display =
    data.manualUpdate || data.preUpdate || data.info ? "block" : "none";

  if (data.lastUpdated) {
    timestampDiv.textContent = "Last updated: " + data.lastUpdated;
  }
});

