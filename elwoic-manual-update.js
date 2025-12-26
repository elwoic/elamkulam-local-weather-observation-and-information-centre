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

  function dateOnlyTimestampFromDMY(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const parts = ddmmyyyy.split("/");
    if (parts.length !== 3) return NaN;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    return new Date(y, m, d).setHours(0, 0, 0, 0);
  }

  const manualDiv = document.getElementById("weather-message");
  const preDiv = document.getElementById("preupdate-message");
  const infoDiv = document.getElementById("info-message");
  const manualSection = document.getElementById("manual-update");

  const timestampDiv = document.createElement('div');
  timestampDiv.style.fontSize = '0.7rem';
  timestampDiv.style.color = '#888';
  timestampDiv.style.marginTop = '10px';
  manualSection.appendChild(timestampDiv);

  onValue(ref(db, "/"), (snapshot) => {
    const data = snapshot.val() || {};
    const now = new Date();
    const todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Reset fields
    manualDiv.classList.remove("blink-alert");
    preDiv.classList.remove("blink-alert");
    manualDiv.textContent = "No update provided."; // Default placeholder text
    preDiv.textContent = "No pre-update scheduled.";
    infoDiv.textContent = "No additional info.";

    const manualTs = dateOnlyTimestampFromDMY(data.manualUpdate?.date);
    const preTs = dateOnlyTimestampFromDMY(data.preUpdate?.date);

    /* -------- MANUAL LOGIC -------- */
    if (data.manualUpdate && !Number.isNaN(manualTs) && todayTs === manualTs) {
      manualDiv.textContent = data.manualUpdate.text;
      manualDiv.style.color = "red"; 
      if (data.manualUpdate.blink) manualDiv.classList.add("blink-alert");
    } 
    else if (data.preUpdate && !Number.isNaN(preTs) && todayTs === preTs) {
      manualDiv.textContent = data.preUpdate.text;
      manualDiv.style.color = "red"; 
      if (data.preUpdate.blink) manualDiv.classList.add("blink-alert");
    } 

    /* -------- PRE UPDATE LOGIC -------- */
    if (data.preUpdate && !Number.isNaN(preTs) && todayTs < preTs) {
      preDiv.textContent = data.preUpdate.text;
      preDiv.style.color = "#f1c40f"; 
      if (data.preUpdate.blink) preDiv.classList.add("blink-alert");
    }

    /* -------- INFO -------- */
    if (data.info?.text) {
      infoDiv.textContent = data.info.text;
    }

    /* -------- VISIBILITY LOGIC -------- */
    // We only hide the ENTIRE box if the database is completely empty
    if (!data.manualUpdate && !data.preUpdate && !data.info) {
      manualSection.style.display = "none";
    } else {
      manualSection.style.display = "block";
      if(data.lastUpdated) {
        timestampDiv.textContent = "Last updated: " + data.lastUpdated;
      }
    }
  });
