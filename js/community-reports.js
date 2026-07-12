import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const bridgeConfig = {
  apiKey: "AIzaSyD1aZw3jvnMAzt6enCG6_DGkxaSQqg2NlA",
  authDomain: "weather-report-66bdf.firebaseapp.com",
  databaseURL: "https://weather-report-66bdf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "weather-report-66bdf",
  storageBucket: "weather-report-66bdf.firebasestorage.app",
  messagingSenderId: "599939260562",
  appId: "1:599939260562:web:a0fbf532279a191559864b"
};

const app       = initializeApp(bridgeConfig, "site2App");
const db        = getDatabase(app);
const container = document.getElementById("community-reports");
const q         = query(ref(db, "weather_reports"), orderByChild("granted_site2"), equalTo("yes"));

onValue(q, (snapshot) => {
  const data = snapshot.val();
  container.innerHTML = "";
  if (!data) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">No community reports available at this time.</div>`;
    return;
  }
  const now     = Date.now();
  const reports = Object.values(data)
    .filter(r => r.granted_site2 === "yes" && (!r.expiration_site2 || r.expiration_site2 > now))
    .sort((a, b) => (b.submitted_at || 0) - (a.submitted_at || 0));

  if (!reports.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">No approved reports to display right now.</div>`;
    return;
  }
  reports.forEach(r => {
    const div = document.createElement("div");
    div.className = "report-item";
    div.innerHTML = `ഈ സമയത്ത് നാട്ടുകാരുടെ നിരീക്ഷണങ്ങൾ:
      <strong>"${r.event_time || 'N/A'}"</strong> സമയത്ത്
      <strong>"${r.location || 'Unknown'}"</strong> നിന്നും —
      <strong>"${r.report_content || 'വിവരങ്ങൾ ലഭ്യമല്ല'}"</strong>
      <div class="report-meta">Reporter: ${r.display_name || 'Anonymous'}</div>`;
    container.appendChild(div);
  });
});
