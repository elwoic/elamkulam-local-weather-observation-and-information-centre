/* ============================================================
   Firebase setup
============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ============================================================
   Helper: DD/MM/YYYY → date-only timestamp
============================================================ */
function dateOnlyTimestampFromDMY(ddmmyyyy) {
  if (!ddmmyyyy) return NaN;
  const parts = ddmmyyyy.split("/");
  if (parts.length !== 3) return NaN;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  return new Date(y, m, d).setHours(0, 0, 0, 0);
}

const defaultManual = "No manual updates available.";
const defaultPre = "No new pre-updates.";
const defaultInfo = "No additional information.";

const manualDiv = document.getElementById("weather-message");
const preDiv = document.getElementById("preupdate-message");
const infoDiv = document.getElementById("info-message");
const manualSection = document.getElementById("manual-update");

// Create a small element for the timestamp
const timestampDiv = document.createElement('div');
timestampDiv.style.fontSize = '0.7rem';
timestampDiv.style.color = '#888';
timestampDiv.style.marginTop = '10px';
document.body.appendChild(timestampDiv);

/* ============================================================
   READ FROM FIREBASE & APPLY LOGIC
============================================================ */
onValue(ref(db, "/"), (snapshot) => {
  const data = snapshot.val() || {};
  const now = new Date();
  const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // Reset blink classes
  manualDiv.classList.remove("blink-alert");
  preDiv.classList.remove("blink-alert");

  const manualTs = dateOnlyTimestampFromDMY(data.manualUpdate?.date);
  const preTs = dateOnlyTimestampFromDMY(data.preUpdate?.date);

  /* -------- MANUAL LOGIC (With Hand-off) -------- */
  if (!Number.isNaN(manualTs) && todayTs === manualTs) {
    manualDiv.textContent = data.manualUpdate.text;
    if (data.manualUpdate.blink) manualDiv.classList.add("blink-alert");
  } 
  else if (!Number.isNaN(preTs) && todayTs === preTs) {
    manualDiv.textContent = data.preUpdate.text;
    if (data.preUpdate.blink) manualDiv.classList.add("blink-alert");
  } 
  else {
    manualDiv.textContent = defaultManual;
  }

  /* -------- PRE UPDATE LOGIC -------- */
  if (!Number.isNaN(preTs) && todayTs < preTs) {
    preDiv.textContent = data.preUpdate.text;
    if (data.preUpdate.blink) preDiv.classList.add("blink-alert");
  } else {
    preDiv.textContent = defaultPre;
  }

  /* -------- INFO -------- */
  infoDiv.textContent = data.info?.text || defaultInfo;

  /* -------- VISIBILITY -------- */
  const hasManual = manualDiv.textContent !== defaultManual;
  const hasPre = preDiv.textContent !== defaultPre;
  const hasInfo = infoDiv.textContent !== defaultInfo;
  manualSection.style.display = (hasManual || hasPre || hasInfo) ? "block" : "none";

  /* -------- TIMESTAMP -------- */
  if(data.lastUpdated) {
     timestampDiv.textContent = "Last updated: " + data.lastUpdated;
  }

  console.debug("Firebase data loaded:", data);
}); // End of onValue
