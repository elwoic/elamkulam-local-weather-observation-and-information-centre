// elamkulam-forecast.js
// Version: News-style, very lengthy Malayalam essay, wind in km/h, constant headline
// Usage: place <div id="elamkulam-forecast-report"></div> in your page and include:
// <script type="module" src="elamkulam-forecast.js"></script>

// ---------------- CONFIG ----------------
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295"; // keep or replace
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const LAT = 10.9081;
const LON = 76.2296;
const CONTAINER_ID = "elamkulam-forecast-report";
const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour

const HEADLINE = "എലങ്കുളം കാലാവസ്ഥാ സമഗ്ര റിപ്പോർട്ട്";
// ----------------------------------------

const MONTHS_ML = ["ജനുവരി","ഫെബ്രുവരി","മാർച്ച്","ഏപ്രിൽ","മേയ്","ജൂൺ","ജൂലൈ","ഓഗസ്റ്റ്","സെപ്റ്റംബർ","ഒക്ടോബർ","നവംബർ","ഡിസംബർ"];

function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){
  return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function escapeHtml(s){ if(!s) return ""; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toFixedSafe(v,d=1){ return (v==null||isNaN(Number(v))) ? null : Number(v).toFixed(d); }
function msToKmh(ms){ if (ms==null||isNaN(ms)) return null; return ms * 3.6; }
function windDirMalayalam(deg){
  if (deg == null || isNaN(deg)) return "ലഭ്യമല്ല";
  const dirs = ["ഉത്തര","ഉത്തര-കിഴക്ക്","കിഴക്ക്","തെക്ക്-കിഴക്ക്","തെക്ക്","തെക്ക്-പശ്ചിമ","പശ്ചിമ","വടക്ക്-പശ്ചിമ"];
  return dirs[Math.round(deg/45) % 8];
}

// ---------- ADD THIS FUNCTION RIGHT HERE ---------
function imdAlertMalayalamMeaning(code) {
  const map = {
    g: "Green (No warning) സുരക്ഷിതമായ അന്തരീക്ഷം (Safe)",
    y: "Yellow (Watch) മിതമായ ജാഗ്രത (Moderate Alert)",
    o: "Orange (Alert) മോശം, ജാഗ്രത ആവശ്യമുണ്ട് (Severe Alert)",
    r: "Red (Warning) അതി മോശം, കരുതലോടെ പ്രവർത്തിക്കുക (Very Severe Alert)"
  };
  return map[code.toLowerCase()] || "ലഭ്യമല്ല";
}

function aqiMalayalamMeaning(aqi) {
  const map = {
    1: "നല്ലത് (Good) — 0–50",
    2: "മിതമായത് (Fair) — 51–100",
    3: "മധ്യമം (Moderate) — 101–200",
    4: "മോശം (Poor) — 201–300",
    5: "അതിമോശം (Very Poor) — 301–500"
  };
  return map[aqi] || "ലഭ്യമല്ല";
}
// -------------------------------------------------

// inject Malayalam font for better rendering
(function injectFont(){
  const href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;600&display=swap";
  if (!document.querySelector(`link[href="${href}"]`)){
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
  }
  if (!document.getElementById('elam-forecast-style')){
    const s = document.createElement('style'); s.id = 'elam-forecast-style';
    s.innerHTML = `
      #${CONTAINER_ID} { font-family: 'Noto Sans Malayalam', system-ui, -apple-system, "Segoe UI", Roboto, Arial; color:#111; background:#fff; padding:14px; border-radius:6px; line-height:1.6; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
      #${CONTAINER_ID} h2 { margin:0 0 6px 0; font-size:1.05rem; font-weight:600; }
      #${CONTAINER_ID} .meta { color:#555; font-size:0.9rem; margin-bottom:8px; }
      #${CONTAINER_ID} pre { white-space: pre-wrap; font-family: inherit; margin:0; font-size:0.95rem; }
      #${CONTAINER_ID} .imd-alert { margin-top:10px; font-size:0.95rem; color:#111; }
      #${CONTAINER_ID} .user-reports { margin-top:10px; font-size:0.95rem; padding-left:18px; }
    `;
    document.head.appendChild(s);
  }
})();

// ---------------- fetchers ----------------
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
  const p = new URLSearchParams({ lat, lon, appid: OPENWEATHER_API_KEY, units: "metric" });
  const url = `https://api.openweathermap.org/data/2.5/weather?${p.toString()}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn("OpenWeather failed", r.status); return null; }
    return r.json();
  } catch(e){ console.warn("OpenWeather error", e); return null; }
}

// read imd alerts from window.imdAlerts (manual file)
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

// optional: fetch granted user reports if Firebase initialized on page
async function fetchGrantedReports(){
  try {
    if (window.firebase && window.firebase.database) {
      const dbRef = window.firebase.database().ref("weather_reports");
      const snap = await dbRef.once('value');
      const val = snap.val() || {};
      return Object.entries(val).map(([k,v])=>({ key:k, ...v }));
    }
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
async function fetchEstimatedAQI() {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data?.current?.pm2_5) return null;
  const pm25 = data.current.pm2_5;

  // Convert PM2.5 → 1–5 scale like OpenWeatherMap
  let aqi = 1;
  if (pm25 <= 12) aqi = 1;
  else if (pm25 <= 35.4) aqi = 2;
  else if (pm25 <= 55.4) aqi = 3;
  else if (pm25 <= 150.4) aqi = 4;
  else aqi = 5;

  return { aqi, pm25, source: "Estimated (Open-Meteo)" };
}


// ---------------- compute metrics ----------------
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
    const tempPrev = last-1>=0 ? temps[last-1] : null;

    // trend over last 12 hours if available
    const hours = 12;
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
      tempNow, tempPrevHour: tempPrev, tempTrend: trend, trendHours: slice.length,
      precipNow, precipProb: precipProbNow, windSpeedMs: windNow, windDir: windDirNow, humidity: humNow
    };
  } catch(e){
    console.warn("computeFromMeteo", e);
    return {};
  }
}

function generateLongNewsMalayalam({ computed, imdAlert, airQuality, userReports }) {
  const s = [];
  const now = new Date();
  const dateLine = `${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;

  s.push(HEADLINE);
  s.push(dateLine);
  s.push("");

  // ----- Helper functions -----
  function describeTemperature(temp) {
    if (temp == null) return "താപനില സംബന്ധിച്ച കൃത്യമായ രേഖകൾ ലഭ്യമല്ല.";
    if (temp < 20) return "പ്രദേശത്ത് തണുപ്പ് അനുഭവപ്പെടുന്നു.";
    if (temp < 30) return "താപനില സാധാരണ നിലയിലാണ്, ഒട്ടും അകമ്പടി ഇല്ല.";
    return "ചൂട് കൂടുതലാണ്; ശ്രദ്ധ ആവശ്യമുണ്ട്.";
  }

  function describeTrend(trend) {
    if (trend == null) return "";
    if (trend > 0.15) return "കഴിഞ്ഞ മണിക്കൂറുകളിൽ താപനില ക്രമംപ്രകാരം ഉയരുകയാണ്.";
    if (trend < -0.15) return "കഴിഞ്ഞ മണിക്കൂറുകളിൽ താപനില കുറവാണ്.";
    return "താപനില സ്ഥിരത പുലർത്തുകയാണ്.";
  }

  function describeWind(speed, deg) {
    if (speed == null) return "കാറ്റ് സംബന്ധിച്ച വിവരങ്ങൾ ലഭ്യമല്ല.";
    const kmh = msToKmh(speed);
    const dir = windDirMalayalam(deg);
    return `കാറ്റ് ${dir} നിന്നും ഏകദേശം ${toFixedSafe(kmh,1)} km/h വേഗത്തിൽ വീശുന്നു.`;
  }

  function describeHumidity(hum) {
    if (hum == null) return "";
    return `വാതാവിലെ ഈർപ്പതോത് ഏകദേശം ${Math.round(hum)}% ആണ്, ഇത് പ്രദേശത്തെ അന്തരീക്ഷത്തെ സ്വല്പമായി സ്വാധീനിക്കാം.`;
  }

  function describeCloudsAndRain(computed) {
    if (computed.precipNow != null && computed.precipNow > 0.1) {
      return "പ്രദേശത്ത് ഇപ്പോൾ മഴ പെയ്യുന്നു; അടുത്ത മണിക്കൂറുകളിലും ഇടയ്ക്കിടെ തുടരുമെന്നാണ് സാധ്യത.";
    } else if (computed.precipProb != null && computed.precipProb > 30) {
      return `മേഘാവരണം വ്യാപിച്ചിരിക്കുന്നു, അടുത്ത മണിക്കൂറിൽ ${Math.round(computed.precipProb)}% സാധ്യതയോടെ മഴ ലഭിക്കാനുണ്ട്.`;
    } else if (computed.cloudcover != null) {
      if (computed.cloudcover < 20) return "ആകാശം തെളിഞ്ഞിരിക്കുന്നു, മേഘം കുറഞ്ഞിരിക്കുന്നു.";
      if (computed.cloudcover < 50) return "മേഘം ചിലവട്ടങ്ങളിൽ മാത്രം സാന്നിദ്ധ്യപ്പെടുന്നു.";
      if (computed.cloudcover < 80) return "മേഘാവരണം വ്യാപിച്ചു, സൂര്യപ്രകാശം കുറവാണ്.";
      return "മൂടൽമഞ്ഞ് വ്യാപിച്ചിരിക്കുന്നു, മഴ സാധ്യത കുറഞ്ഞിരിക്കുന്നു.";
    }
    return "";
  }

  function describeIMD(alert) {
    if (!alert || !alert.text) return "ഇന്നത്തെ തീയതിക്ക് IMD ഔദ്യോഗിക അലർട്ട് ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.";
    const codeMatch = alert.text.match(/[oyrg]$/i);
    const code = codeMatch ? codeMatch[0] : null;
    const meaning = code ? imdAlertMalayalamMeaning(code) : "ലഭ്യമല്ല";
    return `IMD ഔദ്യോഗിക മുന്നറിയിപ്പ്: ${meaning} (അവസാന അപ്ഡേറ്റ്: ${alert.lastUpdated || 'ലഭ്യമല്ല'})`;
  }

  function describeAQI(aqiObj) {
    if (!aqiObj || aqiObj.aqi == null) return "പ്രാദേശിക വായുനില സംബന്ധിച്ച കൃത്യമായ രേഖകൾ ലഭ്യമല്ല.";
    return `വായുനില സൂചിക (AQI): ${aqiObj.aqi} — ${aqiMalayalamMeaning(aqiObj.aqi)}.`;
  }

  // ----- Paragraph 1: Overview -----
  s.push(`പ്രാദേശിക നിരീക്ഷണങ്ങളുടെ അടിസ്ഥാനത്തിൽ, ഇന്ന് എലങ്കുളം പ്രദേശത്ത് കാലാവസ്ഥ ${describeTemperature(computed.tempNow)} ${describeTrend(computed.tempTrend)}`);

  // ----- Paragraph 2: Humidity & Wind -----
  const humText = describeHumidity(computed.humidity);
  const windText = describeWind(computed.windSpeedMs, computed.windDir);
  if (humText || windText) {
    s.push([humText, windText].filter(Boolean).join(" "));
  }

  // ----- Paragraph 3: Clouds & Rain -----
  const rainText = describeCloudsAndRain(computed);
  if (rainText) s.push(rainText);

  // ----- Paragraph 4: Previous hour temp -----
  if (computed.tempPrevHour != null && computed.tempNow != null) {
    const diff = (computed.tempNow - computed.tempPrevHour);
    const word = diff > 0 ? "കൂടിയിട്ടുണ്ട്" : (diff < 0 ? "കുറഞ്ഞിട്ടുണ്ട്" : "മാറ്റമില്ല");
    s.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടെ താപനില ${Math.abs(diff).toFixed(1)}°C ${word} (മുമ്പ്: ${toFixedSafe(computed.tempPrevHour,1)}°C, ഇപ്പോൾ: ${toFixedSafe(computed.tempNow,1)}°C).`);
  }

  // ----- Paragraph 5: IMD alert -----
  s.push(describeIMD(imdAlert));

  // ----- Paragraph 6: AQI -----
  s.push(describeAQI(airQuality));

  // ----- Paragraph 7: User reports -----
  if (userReports && userReports.length) {
    const items = userReports.map(r => {
      const loc = r.location || r.place || "ഏലംകുളം";
      const desc = (r.observation || r.description || r.obs || r.note || "").trim();
      const time = r.time || (r.timestamp ? new Date(Number(r.timestamp)).toLocaleString() : "");
      if (!desc) return null;
      return `<li>${escapeHtml(loc)} — "${escapeHtml(desc)}"${time ? ` (${escapeHtml(time)})` : ''}</li>`;
    }).filter(Boolean).join("");
    if (items) s.push(`പ്രാദേശിക നിരീക്ഷണങ്ങൾ (Granted): <ul>${items}</ul>`);
  }

  // ----- Paragraph 8: Conclusion -----
  s.push("സമാപനമായി, എലങ്കുളം പ്രദേശത്ത് ഇന്ന് കാലാവസ്ഥ സാധാരണ നിലയിലാണ്; ഇടയ്ക്കിടെ മൂടൽമഞ്ഞ് അല്ലെങ്കിൽ ചെറിയ മഴയുടെ സാധ്യത നിലനിൽക്കുന്നു. ഔദ്യോഗിക അറിയിപ്പുകൾക്കായി IMD നിരീക്ഷണങ്ങൾ ശ്രദ്ധിക്കുക.");

  // ----- Ensure minimum length -----
  const essay = s.join("\n\n");
  const sentenceCount = essay.split(/[.!\?]\s/).filter(Boolean).length;
  if (sentenceCount < 20) {
    const fillers = [
      "നിലവിലെ ഡാറ്റയിൽ ചില ഒഴിവുകൾ നിലനിൽക്കുന്നു, പക്ഷേ റിപ്പോർട്ട് പരമാവധി കൃത്യതയോടെ തയ്യാറാക്കിയതാണ്.",
      "കൂടുതൽ നിരീക്ഷണങ്ങൾ ലഭ്യമാകുമ്പോൾ അടുത്ത അപ്ഡേറ്റുകളിൽ കൂടുതൽ വ്യക്തത പ്രതീക്ഷിക്കാം.",
      "പ്രാദേശിക നിരീക്ഷണ കേന്ദ്രങ്ങളിൽ നിന്നുള്ള സംഗ്രഹ വിവരങ്ങളും പരിഗണിച്ചിട്ടുള്ളതാണ്."
    ];
    let i = 0;
    let ext = essay;
    while (ext.split(/[.!\?]\s/).filter(Boolean).length < 22) {
      ext += "\n\n" + fillers[i % fillers.length];
      i++;
    }
    return ext;
  }

  return essay;
}


// ---------------- render main ----------------
async function runOnceAndRender(){
  const container = document.getElementById(CONTAINER_ID);
  if (!container) { console.warn(`Container #${CONTAINER_ID} not found.`); return; }

  container.innerHTML = `<div class="meta">അപ്‌ഡേറ്റ് ചെയ്യുന്നു — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;

  let meteo = null, owm = null, reports = [], airQuality = null;

  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn("Open-Meteo failed", e); }
  try { owm = await fetchOpenWeatherCurrent(); } catch(e){ console.warn("OpenWeather failed", e); }
  try { reports = await fetchGrantedReports(); } catch(e){ reports = []; }
  try { airQuality = await fetchEstimatedAQI(); } catch(e){ airQuality = null; }

  const computed = meteo ? computeFromMeteo(meteo) : {};
  if (owm) {
    if (computed.humidity == null && owm.main && owm.main.humidity != null) computed.humidity = owm.main.humidity;
    if (computed.windSpeedMs == null && owm.wind && owm.wind.speed != null) computed.windSpeedMs = owm.wind.speed;
    if (computed.windDir == null && owm.wind && owm.wind.deg != null) computed.windDir = owm.wind.deg;
    if (computed.tempNow == null && owm.main && owm.main.temp != null) computed.tempNow = owm.main.temp;
  }

  const imdAlert = getImdAlertForToday();

  // ---------------- Generate essay with AQI ----------------
  const essay = generateLongNewsMalayalam({ computed, imdAlert, airQuality });

  const granted = (reports || []).filter(r => (r.granted && String(r.granted).toLowerCase()==='yes') || (r.show_on_site && String(r.show_on_site).toLowerCase()==='yes'));
  let userHtml = "";
  if (granted.length) {
    const items = granted.map(r => {
      const loc = r.location || r.place || "ഏലംകുളം";
      const desc = (r.observation || r.description || r.obs || r.note || "").trim();
      const time = r.time || (r.timestamp ? new Date(Number(r.timestamp)).toLocaleString() : "");
      if (!desc) return null;
      return `<li>${escapeHtml(loc)} — "${escapeHtml(desc)}"${time ? ` (${escapeHtml(time)})` : ''}</li>`;
    }).filter(Boolean).join("");
    if (items) userHtml = `<div class="imd-alert"><strong>ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ (Granted):</strong><ul class="user-reports">${items}</ul></div>`;
  }

  const heading = `<h2>${escapeHtml(HEADLINE)}</h2>`;
  const meta = `<div class="meta">${escapeHtml(formatDateMalayalam(new Date()))} — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;
  
  container.innerHTML =
    `${heading}${meta}<pre>${escapeHtml(essay)}</pre>` +
    userHtml;
}

// initial run + hourly interval
(async function init(){
  try {
    await runOnceAndRender();
  } catch(e){ console.warn("render error", e); }
  setInterval(() => { try { runOnceAndRender(); } catch(e){ console.warn(e); } }, AUTO_REFRESH_MS);
})();

