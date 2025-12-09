// elamkulam-forecast.js
// Drop-in module for GitHub-hosted static site
// - Format C: "DD Month YYYY — എലങ്കുളം കാലാവസ്ഥാ റിപ്പോർട്ട്"
// - Uses Open-Meteo (hourly) + OpenWeather current (optional)
// - Auto-refresh: every 1 hour (3600000 ms)
// - Reads IMD alerts from window.imdAlerts & window.imdLastUpdated
// - Attempts to fetch "granted" user reports if your site initializes Firebase
// ---------------------------------------------------------------------------

// ---------- CONFIG ----------
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295"; // you provided earlier
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const LAT = 10.9081;   // Elamkulam latitude
const LON = 76.2296;   // Elamkulam longitude
const CONTAINER_ID = "elamkulam-forecast-report";
const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour

// Malayalam month names
const MONTHS_ML = ["ജനുവരി","ഫെബ്രുവരി","മാർച്ച്","ഏപ്രിൽ","മേയ്","ജൂൺ","ജൂലൈ","ഓഗസ്റ്റ്","സെപ്റ്റംബർ","ഒക്ടോബർ","നവംബർ","ഡിസംബർ"];

// ---------- UTILS ----------
function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){
  const dd = pad(d.getDate());
  const mm = MONTHS_ML[d.getMonth()];
  const yyyy = d.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}
function formatTimeMalayalam(d){
  const hh = pad(d.getHours()), mm = pad(d.getMinutes());
  return `${hh}:${mm}`;
}
function escapeHtml(s){ if(!s) return ""; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toFixedSafe(v, digits=1){ return (v==null||Number.isNaN(v)) ? null : Number(v).toFixed(digits); }
function windDirMalayalam(deg){
  if (deg == null) return "";
  const dirs = ["ഉത്തര","ഉത്തര-കിഴക്ക്","കിഴക്ക്","തെക്ക്-കിഴക്ക്","തെക്ക്","തെക്ക്-പശ്ചിമ","പശ്ചിമ","വടക്ക്-പശ്ചിമ"];
  return dirs[Math.round(deg/45) % 8];
}

// ---------- FONT (inject Noto Sans Malayalam) ----------
(function injectFont(){
  const href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;600&display=swap";
  if (!document.querySelector(`link[href="${href}"]`)){
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  // minimal style for the container
  const styleId = "elamkulam-forecast-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.innerHTML = `
      #${CONTAINER_ID} { font-family: 'Noto Sans Malayalam', system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111; background: #fff; padding:12px; border-radius:6px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); line-height:1.6; }
      #${CONTAINER_ID} pre { white-space: pre-wrap; font-family: inherit; font-size: 0.96rem; margin:0; }
      #${CONTAINER_ID} h2 { margin:0 0 8px 0; font-size:1.08rem; font-weight:600; }
      #${CONTAINER_ID} .meta { color:#555; font-size:0.88rem; margin-bottom:8px; }
      #${CONTAINER_ID} .reports-list { margin-top:10px; padding-left:18px; }
      #${CONTAINER_ID} .reports-list li { margin-bottom:6px; }
    `;
    document.head.appendChild(s);
  }
})();

// ---------- FETCH FUNCTIONS ----------
async function fetchOpenMeteoHourly(lat=LAT, lon=LON){
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    hourly: "temperature_2m,relativehumidity_2m,precipitation,precipitation_probability,windspeed_10m,winddirection_10m,cloudcover",
    past_days: "1",
    forecast_days: "1"
  });
  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Open-Meteo fetch failed: " + r.status);
  return r.json();
}

async function fetchOpenWeatherCurrent(lat=LAT, lon=LON){
  if (!OPENWEATHER_API_KEY) return null;
  const params = new URLSearchParams({ lat, lon, appid: OPENWEATHER_API_KEY, units: "metric" });
  const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn("OpenWeather failed", r.status); return null; }
    return r.json();
  } catch(e){ console.warn("OpenWeather error", e); return null; }
}

// ---------- IMD ALERT READ ----------
function getImdAlertForToday(){
  try {
    const alerts = window.imdAlerts || {};
    const lastUpdated = window.imdLastUpdated || null;
    const now = new Date();
    const key = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    if (alerts[key]) return { text: alerts[key].text, lastUpdated };
    return null;
  } catch(e){ return null; }
}

// ---------- FIREBASE GRANTED REPORTS (optional) ----------
async function fetchGrantedReports(){
  try {
    // If legacy firebase present on page
    if (window.firebase && window.firebase.database) {
      const dbRef = window.firebase.database().ref("weather_reports");
      const snap = await dbRef.once('value');
      const val = snap.val() || {};
      return Object.entries(val).map(([k,v])=>({ key:k, ...v }));
    }
    // If modular SDK not present, and config is on window (optional)
    if (window.elwoicFirebaseConfig) {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getDatabase, ref, get } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
      const app = initializeApp(window.elwoicFirebaseConfig);
      const db = getDatabase(app);
      const snapshot = await get(ref(db, "weather_reports"));
      const val = snapshot.val() || {};
      return Object.entries(val).map(([k,v])=>({ key:k, ...v }));
    }
    return [];
  } catch(e){
    console.warn("fetchGrantedReports error", e);
    return [];
  }
}

// ---------- COMPUTE METRICS ----------
function computeFromMeteo(m){
  try {
    const h = m.hourly || {};
    const times = h.time || [];
    const temps = h.temperature_2m || [];
    const hum = h.relativehumidity_2m || [];
    const precip = h.precipitation || [];
    const precipProb = h.precipitation_probability || [];
    const windspeed = h.windspeed_10m || [];
    const winddir = h.winddirection_10m || [];
    if (!times.length) return {};

    const last = times.length - 1;
    const tempNow = temps[last] ?? null;
    const prev = last - 1 >= 0 ? temps[last-1] : null;

    // trend over last 6 hours if available
    const hours = 6;
    const start = Math.max(0, last - hours + 1);
    const slice = temps.slice(start, last+1).filter(v=>v!=null);
    let trend = null;
    if (slice.length >= 2){
      trend = (slice[slice.length-1] - slice[0]) / Math.max(1, slice.length-1);
    }

    const precipNow = precip[last] ?? null;
    const precipProbNow = precipProb[last] ?? null;
    const windNow = windspeed[last] ?? null;
    const windDirNow = winddir[last] ?? null;
    const humNow = hum[last] ?? null;

    return {
      tempNow, tempPrevHour: prev, tempTrend: trend, trendHours: slice.length,
      precipNow, precipProb: precipProbNow, windSpeed: windNow, windDir: windDirNow, humidity: humNow
    };
  } catch(e){
    console.warn("computeFromMeteo", e);
    return {};
  }
}

// ---------- REPORT GENERATOR (Malayalam, long/professional) ----------
function generateMalayalamReport({ computed, imdAlert, airQuality }){
  const lines = [];
  const now = new Date();
  const header = `${formatDateMalayalam(now)} — എലമ്കുളം കാലാവസ്ഥാ റിപ്പോർട്ട്`;
  lines.push(header);
  lines.push(""); // blank

  // 1) Current conditions
  lines.push("1) നിലവിലുള്ള അവസ്ഥ:");
  const cur = [];
  cur.push(`താപനില: ${computed.tempNow != null ? toFixedSafe(computed.tempNow,1) + "°C" : "ലഭ്യമല്ല"}`);
  if (computed.humidity != null) cur.push(`ഹ്യൂമിഡിറ്റി: ${Math.round(computed.humidity)}%`);
  if (computed.windSpeed != null){
    const wd = computed.windDir != null ? ` (ദിശ: ${windDirMalayalam(computed.windDir)} ${Math.round(computed.windDir)}°)` : "";
    cur.push(`കാറ്റിന്റെ വേഗം: ${toFixedSafe(computed.windSpeed,1)} മീ/സെ${wd}`);
  }
  if (computed.precipNow != null) cur.push(`കഴിഞ്ഞ മണിക്കൂറിൽ രേഖപ്പെടുത്തിയ മഴ: ${toFixedSafe(computed.precipNow,1)} മിമീ`);
  lines.push(cur.join("; ") + ".");

  lines.push(""); // blank

  // 2) Earlier today / past hour
  lines.push("2) ഇന്നത്തെ അപേക്ഷയില്‍ (കഴിഞ്ഞ മണിക്കൂർ / ഇന്നലെ മുതൽ):");
  if (computed.tempPrevHour != null && computed.tempNow != null){
    const diff = computed.tempNow - computed.tempPrevHour;
    const sign = diff > 0 ? "ഉയർന്നു" : (diff < 0 ? "കുറഞ്ഞു" : "മാറ്റമില്ല");
    lines.push(`കഴിഞ്ഞ 1 മണിക്കൂറിനിടെ താപനില ${Math.abs(diff).toFixed(1)}°C ${sign} (മുമ്പ്: ${toFixedSafe(computed.tempPrevHour,1)}°C, ഇപ്പോൾ: ${toFixedSafe(computed.tempNow,1)}°C).`);
  } else {
    lines.push("കഴിഞ്ഞ മണിക്കൂറിനുള്ളിലെ താരതമ്യേന വിശദാംശങ്ങൾ ലഭ്യമല്ല.");
  }

  lines.push("");

  // 3) Temperature trend
  lines.push("3) താപനില പ്രവണത:");
  if (computed.tempTrend != null){
    const trendDesc = computed.tempTrend > 0.15 ? "ഉയർച്ചാ പ്രവണത" : (computed.tempTrend < -0.15 ? "തണുത്ത് പ്രവേശനം" : "സ്ഥിരം") ;
    lines.push(`കഴിഞ്ഞ ${computed.trendHours || 6} മണിക്കൂറിനോടനുബന്ധിച്ച ശരാശരി മാറ്റം: ${toFixedSafe(computed.tempTrend,2)}°C/മണിക്കൂർ — ${trendDesc}.`);
    if (computed.tempTrend > 0.15) lines.push("മിക്കവാറും താപനില ഉയരാനാണ് സൂചന.");
    else if (computed.tempTrend < -0.15) lines.push("മിക്കവാറും താപനില കുറയാനാണ് സൂചന.");
    else lines.push("താപനിലയിൽ വ്യക്തമായ ഉയർച്ച/താഴ്വാനം റിപ്പോർട്ട് ചെയ്യപ്പെടുന്നില്ല.");
  } else {
    lines.push("മുൻകാല ഡാറ്റയുടെ പര്യാപ്തത ഇല്ലാത്തതിനാൽ പ്രവണത കണക്കാക്കാനായില്ല.");
  }

  lines.push("");

  // 4) Rain probability
  lines.push("4) മഴ സാധ്യത:");
  if (computed.precipProb != null){
    lines.push(`മറ്റു മണിക്കൂറുകളിൽ ശരാശരി പ്രവചനപ്രകാരം മഴസാദ്ധ്യത: ${Math.round(computed.precipProb)}% (മോഡൽ അടിസ്ഥാനത്തിൽ).`);
  } else if (computed.precipNow != null && computed.precipNow > 0.1){
    lines.push("ഇപ്പോൾ മഴ തുടരുന്നതായുള്ള രേഖപ്പെട്ട രേഖകൾ നിലനിൽക്കുന്നു.");
  } else {
    lines.push("പ്രധാന ഡാറ്റാവിനിമയങ്ങളുടെ അടിസ്ഥാനത്തിൽ അടുത്ത മണിക്കൂറുകളിൽ ശക്തമായ മഴയല്ല തോന്നിക്കുന്നത്.");
  }

  lines.push("");

  // 5) അറിയിപ്പുകൾ / മുന്നറിയിപ്പുകൾ
  lines.push("5) അറിയിപ്പുകൾ / മുന്നറിയിപ്പുകൾ:");
  if (imdAlert && imdAlert.text){
    lines.push(`IMD (മലപ്പുറം) അറിയിപ്പ്: ${imdAlert.text}  (അവസാന അപ്‌ഡേറ്റ്: ${imdAlert.lastUpdated || 'ലഭ്യമല്ല'}).`);
  } else {
    lines.push("IMD-യുടെ ഔദ്യോഗിക മാനുവൽ അലേർട്ടുകൾ ഈ തീയതിക്ക് ലഭ്യമല്ല.");
  }

  lines.push("");

  // 6) വായുനില (Air quality)
  lines.push("6) വായുനില:");
  if (airQuality && (airQuality.aqi != null || airQuality.main != null)){
    lines.push(`AQI: ${airQuality.aqi ?? 'ലഭ്യമല്ല'}; പ്രധാന ഭാഗികാംശം: ${airQuality.main ?? 'ലഭ്യമല്ല'}.`);
  } else {
    lines.push("പ്രാദേശിക വായുനില സംബന്ധമായ അപ്ഡേറ്റുകൾ ലഭ്യമല്ല.");
  }

  lines.push("");

  // 7) കാറ്റ് നിരീക്ഷണം
  lines.push("7) കാറ്റ് നിരീക്ഷണം:");
  if (computed.windSpeed != null){
    if (computed.windSpeed >= 14) lines.push(`നിലവിൽ ശക്തമായ കാറ്റ് രേഖപ്പെടുന്നു (${toFixedSafe(computed.windSpeed,1)} മീ/സെ, ദിശ: ${computed.windDir != null ? windDirMalayalam(computed.windDir) : 'ലഭ്യമല്ല'}).`);
    else lines.push(`കാറ്റിന്റെ നിലവിലെ വേഗം: ${toFixedSafe(computed.windSpeed,1)} മീ/സെ (${computed.windDir != null ? windDirMalayalam(computed.windDir) : 'ദിശ ലഭ്യമല്ല'}).`);
  } else {
    lines.push("കാറ്റ് സംബന്ധമായ വിവരങ്ങൾ ലഭ്യമല്ല.");
  }

  lines.push("");
  lines.push("റിപ്പോർട്ട്: എലമ്കുളം. ഈ രിപോർട്ട് കാലാവസ്ഥാ നിരീക്ഷണത്തിന്റെ അടിസ്ഥാനത്തിലാണ് — നിര്‍ദ്ദേശങ്ങള്‍ ഉൾപ്പെട്ടിട്ടില്ല.");

  return lines.join("\n\n");
}

// ---------- RENDER / MAIN ----------
async function runOnceAndRender(){
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn(`Container with id "${CONTAINER_ID}" not found.`);
    return;
  }
  // show loading
  container.innerHTML = `<div class="meta">അപ്പ്ഡേറ്റ് ചെയ്യുന്നു… (${formatTimeMalayalam(new Date())})</div>`;

  // Fetch data (parallel)
  let meteo = null, owm = null, reports = [];
  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn("Open-Meteo failed", e); }
  try { owm = await fetchOpenWeatherCurrent(); } catch(e){ console.warn("OpenWeather failed", e); }
  try { reports = await fetchGrantedReports(); } catch(e){ reports = []; }

  const computed = meteo ? computeFromMeteo(meteo) : {};
  // supplement with OpenWeather if fields missing
  if (owm){
    if (computed.humidity == null && owm.main && owm.main.humidity != null) computed.humidity = owm.main.humidity;
    if (computed.windSpeed == null && owm.wind && owm.wind.speed != null) computed.windSpeed = owm.wind.speed;
    if (computed.windDir == null && owm.wind && owm.wind.deg != null) computed.windDir = owm.wind.deg;
    if (computed.tempNow == null && owm.main && owm.main.temp != null) computed.tempNow = owm.main.temp;
  }

  // airQuality placeholder (not called by default)
  const airQuality = null;

  const imdAlert = getImdAlertForToday();

  const malReport = generateMalayalamReport({ computed, imdAlert, airQuality });

  // Build HTML
  const heading = `<h2>${escapeHtml(formatDateMalayalam(new Date()))} — എലങ്കുളം കാലാവസ്ഥാ റിപ്പോർട്ട്</h2>`;
  const meta = `<div class="meta">അപ്‌ഡേറ്റ്: ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;
  const pre = `<pre>${escapeHtml(malReport)}</pre>`;

  // User reports (granted only)
  const granted = (reports || []).filter(r => (r.granted && String(r.granted).toLowerCase()==='yes') || (r.show_on_site && String(r.show_on_site).toLowerCase()==='yes'));
  let userHtml = "";
  if (granted.length){
    const items = granted.map(r=>{
      const loc = r.location || r.place || "എലമ്കുളം";
      const desc = (r.observation || r.description || r.obs || "").trim();
      const time = r.time || (r.timestamp ? new Date(Number(r.timestamp)).toLocaleString() : "");
      if (!desc) return null;
      return `<li>${escapeHtml(loc)} — "${escapeHtml(desc)}" ${time ? `(${escapeHtml(time)})` : ''}</li>`;
    }).filter(Boolean).join("");
    if (items){
      userHtml = `<div><strong>ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ (Granted):</strong><ul class="reports-list">${items}</ul></div>`;
    }
  }

  container.innerHTML = `${heading}${meta}${pre}${imdAlert && imdAlert.text ? `<p style="margin-top:8px;"><strong>IMD അറിയിപ്പ് (മലപ്പുറം):</strong> ${escapeHtml(imdAlert.text)} <small>(Last updated: ${escapeHtml(imdAlert.lastUpdated || '')})</small></p>` : ''}${userHtml}`;
}

// initial run and interval
(async function init(){
  await runOnceAndRender();
  setInterval(runOnceAndRender, AUTO_REFRESH_MS);
})();
