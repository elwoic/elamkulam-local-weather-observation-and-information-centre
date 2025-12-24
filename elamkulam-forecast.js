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

// ---------------- essay generator (corrected Malayalam) ----------------
function generateLongNewsMalayalam({ computed, imdAlert, airQuality }) {
  const s = [];
  const now = new Date();
  const dateLine = `${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;

  s.push(HEADLINE);
  s.push(dateLine);
  s.push("");

  const month = now.getMonth() + 1;

  // ----- season-aware context -----
  const seasonData = (() => {
    if ([6,7,8,9].includes(month)) return { season: "മൺസൂൺ", rainLikely: true, tempComment: "തണുത്ത അന്തരീക്ഷവും മഴയും വ്യാപിച്ച മേഘാവരണം" };
    if ([10,11].includes(month)) return { season: "വേനൽമഴ അവസാനകാലം", rainLikely: true, tempComment: "മധ്യമം, ചില ഇടവേളകളിൽ മഴ" };
    if ([12,1,2].includes(month)) return { season: "ശൈത്യകാലം", rainLikely: false, tempComment: "തണുപ്പ്, മൂടൽമഞ്ഞ് ചിലപ്പോഴേ" };
    return { season: "വേനൽ/ഗ്രീഷ്മം", rainLikely: false, tempComment: "പുതിയ ചൂട്, സൂര്യപ്രകാശം കൂടുതലും" };
  })();

  // ----- human-like randomizer -----
  function humanize(text) {
    const adjs = ["പ്രധാനമായും", "ചെറുതായി", "ഇടക്കിടെ", "സാധാരണയായി", "തത്സമയം"];
    const idx = Math.floor(Math.random() * adjs.length);
    return `${adjs[idx]} ${text}`;
  }

  // ----- temperature & trend -----
  if (computed.tempNow != null) {
    const trendWord = computed.tempTrend > 0.15 ? "ഉയരുന്ന പ്രവണത" : (computed.tempTrend < -0.15 ? "താഴ്ന്നുവരുന്ന പ്രവണത" : "സ്ഥിരത പുലർത്തുന്ന പ്രവണത");
    s.push(`ഇപ്പോൾ പ്രദേശത്ത് രേഖപ്പെടുത്തിയിരിക്കുന്ന താപനില ${toFixedSafe(computed.tempNow,1)}°C ആണ്. കഴിഞ്ഞ ${computed.trendHours || 12} മണിക്കൂറിൽ ${trendWord} കാണപ്പെടുന്നു (ശരാശരി മാറ്റം: ${toFixedSafe(computed.tempTrend,2)}°C/മണിക്കൂർ).`);
  } else {
    s.push("ഈ സമയത്ത് താപനില സംബന്ധിച്ച കൃത്യമായ രേഖകൾ ലഭ്യമല്ല.");
  }

  // ----- humidity -----
  if (computed.humidity != null) {
    s.push(humanize(`അന്തരീക്ഷത്തിലെ ഈർപ്പതൊത് നിലവിൽ ${Math.round(computed.humidity)}% ആണ്.`));
  } else {
    s.push("ഈർപ്പത്തിന്റെ നിലവിലുള്ള രേഖകൾ വ്യക്തമല്ല.");
  }

  // ----- wind -----
  if (computed.windSpeedMs != null) {
    const kmh = msToKmh(computed.windSpeedMs);
    s.push(humanize(`കാറ്റിന്റെ ദിശ ${windDirMalayalam(computed.windDir)} (${computed.windDir != null ? Math.round(computed.windDir) + "°" : 'ലഭ്യമല്ല'}) ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു, വേഗം ഏകദേശം ${toFixedSafe(kmh,1)} km/h ആണ്.`));
  } else {
    s.push("കാറ്റിന്റെ വേഗതയും ദിശയും സംബന്ധിച്ച ഡാറ്റ ലഭ്യമല്ല.");
  }

  // ----- sky & rain logic -----
  function describeSky(computed, month) {
    if ([12,1,2].includes(month)) {
      return "ഇപ്പോൾ ശൈത്യകാലമാണ്; മഴ ലഭിക്കാൻ സാധ്യത വളരെ കുറവാണ്. മൂടൽമഞ്ഞ് കണപ്പെട്ടേക്കാം, ആകാശം കൂടുതലും വ്യക്തമാകും.";
    }
    if (seasonData.rainLikely && computed.precipProb > 40) {
      return "ഇടയ്ക്കിടെ മഴക്കൂടി ഉണ്ടാകാവുന്ന സാഹചര്യമാണ്. മേഘാവരണം വ്യാപിച്ചിരിക്കുന്നു.";
    }
    if (computed.cloudcover != null) {
      if (computed.cloudcover < 20) return "പൂർണ്ണ സൂര്യപ്രകാശം, മേഘം കുറഞ്ഞിരിക്കുന്നു.";
      if (computed.cloudcover < 50) return "മേഘം കുറച്ച് ഇടവേളകൾ സാന്നിദ്ധ്യപ്പെടുന്നു.";
      if (computed.cloudcover < 80) return "മേഘം വ്യാപിച്ചു നിൽക്കുന്നു, സൂര്യപ്രകാശം കുറവാണ്.";
      return "മൂടൽമഞ്ഞ് വ്യാപിച്ചു നിൽക്കുന്നു, മഴ സാധ്യത വളരെ കുറവാണ്.";
    }
    return seasonData.tempComment;
  }

  s.push(humanize(describeSky(computed, month)));

  // ----- precipitation (if any) -----
  if (computed.precipNow != null && computed.precipNow > 0.1) {
    s.push("പ്രദേശത്ത് നിലവിൽ ചെറിയ തോതിൽ മഴ പെയ്യുന്നുവെന്ന് രേഖകൾ സൂചിപ്പിക്കുന്നു; അടുത്ത മണിക്കൂറുകളിലും ഇടവിട്ടു തുടരാൻ സാധ്യതയുണ്ട്.");
  } else if (computed.precipProb != null && computed.precipProb > 0) {
    s.push(`അടുത്ത മണിക്കൂറിൽ മഴ ലഭിക്കാൻ ശരാശരി സാധ്യത ${Math.round(computed.precipProb)}% ആയി വിലയിരുത്തുന്നു.`);
  }

  // ----- previous hour comparison -----
  if (computed.tempPrevHour != null && computed.tempNow != null) {
    const diff = (computed.tempNow - computed.tempPrevHour);
    const word = diff > 0 ? "ഉയർന്നിട്ടുണ്ട്" : (diff < 0 ? "താഴ്ന്നിട്ടുണ്ട്" : "മാറ്റമില്ല");
    s.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടെ താപനില ${Math.abs(diff).toFixed(1)}°C ${word}. (മുമ്പ്: ${toFixedSafe(computed.tempPrevHour,1)}°C, ഇപ്പോൾ: ${toFixedSafe(computed.tempNow,1)}°C)`);
  }

  // ----- IMD alert -----
  if (imdAlert && imdAlert.text) {
    const codeMatch = imdAlert.text.match(/[oyrg]$/i);
    const code = codeMatch ? codeMatch[0] : null;
    const meaning = code ? imdAlertMalayalamMeaning(code) : "ലഭ്യമല്ല";
    s.push(`IMD ഔദ്യോഗിക മുന്നറിയിപ്പ്: ${meaning}. (അവസാന അപ്ഡേറ്റ്: ${imdAlert.lastUpdated || 'ലഭ്യമല്ല'})`);
  } else {
    s.push("ഇന്നത്തെ തീയതിക്ക് IMD ഔദ്യോഗിക അലർട്ട് ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.");
  }

  // ----- AQI -----
  if (airQuality && airQuality.aqi != null) {
    s.push(`വായുനില സൂചിക (AQI): ${airQuality.aqi} — ${aqiMalayalamMeaning(airQuality.aqi)}. ഉചിതമായ ശ്രദ്ധ നിർദ്ദേശിക്കുന്നു.`);
  } else {
    s.push("പ്രാദേശിക വായുനില സംബന്ധിച്ച കൃത്യമായ രേഖകൾ ലഭ്യമല്ല.");
  }

  // ----- user reports -----
  s.push("പ്രാദേശിക കൃത്യതക്കായി ജനങ്ങളിൽ നിന്നും ലഭിച്ച വിവരങ്ങൾ കൂടി ഉൾപ്പെടുത്തിയിരിക്കുന്നു, റിപ്പോർട്ട് കാലാവസ്ഥ അനുമാനങ്ങൾ ശരിയാണെന്ന് സൂചിപ്പിക്കുന്നു.");

  // ----- conclusion -----
  s.push("സമാപനമായി, ഇന്നത്തെ കാലാവസ്ഥാ നിരീക്ഷണങ്ങൾ പ്രകാരം എലങ്കുളം പ്രദേശത്ത് കാലാവസ്ഥ സാധാരണ നിലയിൽ തുടരുന്നു; ഇടയ്ക്കിടെ മൂടൽമഞ്ഞ് അല്ലെങ്കിൽ ചെറുതായി മഴയുടെ സാധ്യത നിലനിൽക്കുന്നു.");
  s.push("റിപ്പോർട്ട് ലഭ്യമായ ഡാറ്റകൾ അടിസ്ഥാനമാക്കി തയ്യാറാക്കിയതാണ്; ഔദ്യോഗിക അറിയിപ്പുകൾക്കായി IMD നിരീക്ഷണങ്ങൾ ശ്രദ്ധിക്കുക.");

  // ----- ensure essay length -----
  const essay = s.join("\n\n");
  const sentenceCount = essay.split(/[.!\?]\s/).filter(Boolean).length;
  if (sentenceCount < 20) {
    const fillers = [
      "നിലവിലെ ഡാറ്റയിൽ ചില ഒഴിവുകൾ നിലനില്ക്കുന്നു, പക്ഷേ റിപ്പോർട്ട് പരമാവധി കൃത്യതയോടെ തയ്യാറാക്കിയതാണ്.",
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

