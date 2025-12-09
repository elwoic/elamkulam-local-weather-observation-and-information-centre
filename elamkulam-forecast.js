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

const HEADLINE = "എലങ്കുളം കാലാവസ്ഥാ വിശദ റിപ്പോർട്ട്";
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

// ---------------- essay generator (very long news style) ----------------
// ---------------- essay generator (professional style, no user names) ----------------
function generateProfessionalMalayalam({ computed, imdAlert, airQuality }){
  const s = [];
  const now = new Date();
  const dateLine = `${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;

  s.push(HEADLINE);
  s.push(dateLine);
  s.push(""); // blank

  // 1. Overview
  s.push("എലങ്കുളം പ്രദേശത്തിന്റെ നിലവിലെ അന്തരീക്ഷ സാഹചര്യങ്ങളെക്കുറിച്ചുള്ള പ്രൊഫഷണൽ റിപ്പോർട്ട് താഴെ ചേർക്കുന്നു.");
  if (computed.tempNow != null) {
    s.push(`ഇപ്പോഴുള്ള താപനില ${toFixedSafe(computed.tempNow,1)}°C ആണ്. കഴിഞ്ഞ മണിക്കൂറുകളിലെ നിരീക്ഷണങ്ങളുമായി താരതമ്യം ചെയ്യുമ്പോൾ താപനില ${computed.tempTrend>0.15 ? 'മിതമായ വർദ്ധനവുള്ള' : (computed.tempTrend < -0.15 ? 'ലഘുവായ കുറവ്' : 'സ്ഥിരമായ')} നിലയിലാണെന്ന് കാണുന്നു.`);
  } else {
    s.push("താപനില സംബന്ധിച്ച നിലവിലെ ഡാറ്റ ലഭ്യമല്ല.");
  }

  // 2. Humidity
  if (computed.humidity != null) {
    s.push(`പ്രാദേശിക വാതാവരണത്തിലെ സാന്ദ്രത (ഹ്യൂമിഡിറ്റി) ${Math.round(computed.humidity)}% ആയി രേഖപ്പെടുത്തപ്പെട്ടിട്ടുണ്ട്.`);
  } else {
    s.push("ഹ്യൂമിഡിറ്റി സംബന്ധിച്ച വിശ്വസ്ത ഡാറ്റ ലഭ്യമല്ല.");
  }

  // 3. Wind
  if (computed.windSpeedMs != null) {
    const kmh = msToKmh(computed.windSpeedMs);
    s.push(`കാറ്റിന്റെ വേഗം ഏകദേശം ${toFixedSafe(kmh,1)} km/h ആണ്; ദിശ ${windDirMalayalam(computed.windDir)} (${computed.windDir != null ? Math.round(computed.windDir)+"°" : 'ലഭ്യമല്ല'}).`);
  } else {
    s.push("കാറ്റ് സംബന്ധിച്ച സമഗ്ര വിവരങ്ങൾ ലഭ്യമല്ല.");
  }

  // 4. Rain & Clouds
  if (computed.precipNow != null && computed.precipNow > 0.1) {
    s.push("പ്രദേശത്ത് നിലവിൽ ചെറിയ മഴ തുടരുകയാണ്.");
  } else if (computed.precipProb != null) {
    s.push(`അടുത്ത മണിക്കൂറുകളിലെ മഴ സാധ്യത ${Math.round(computed.precipProb)}% ആണ്.`);
  } else {
    s.push("മഴ സംബന്ധിച്ച റിപ്പോർട്ടുകൾ ലഭ്യമല്ല.");
  }

  // 5. Trend
  if (computed.tempPrevHour != null && computed.tempNow != null) {
    const diff = (computed.tempNow - computed.tempPrevHour);
    const word = diff > 0 ? "വരുത്തിയ വർദ്ധനവ്" : (diff < 0 ? "കുറഞ്ഞു" : "മാറ്റമില്ല");
    s.push(`കഴിഞ്ഞ മണിക്കൂറിൽ താപനില ${Math.abs(diff).toFixed(1)}°C ${word}.`);
  }
  if (computed.tempTrend != null) {
    const trendVal = computed.tempTrend;
    const trendWord = trendVal > 0.15 ? "ഉയരുന്ന പ്രവണത" : (trendVal < -0.15 ? "താഴ്ന്നുവരുന്ന പ്രവണത" : "സ്ഥിരം പ്രവണത");
    s.push(`കഴിഞ്ഞ ${computed.trendHours || 12} മണിക്കൂറുകളിലെ ശരാശരി മാറ്റത്തിന്റെ അടിസ്ഥാനത്തിൽ താപനില ${trendWord} ആണ്.`);
  }

  // 6. Seasonal Context
  const month = new Date().getMonth() + 1;
  if ([6,7,8,9].includes(month)) {
    s.push("മൂസൂൺ കാലഘട്ടത്തിലാണ്; ശക്തമായ മഴയ്ക്കും വെയിൽക്കുള്ള സാധ്യതകൾ ശ്രദ്ധയിൽ വയ്ക്കേണ്ടതാണ്.");
  } else if ([10,11,12,1].includes(month)) {
    s.push("ശൈതകാല കാലഘട്ടത്തിൽ തണുപ്പ് അനുഭവപ്പെടുന്നു, രാത്രികൾ കൂടുതലായും ശീതപ്രവർത്തനം കാണിക്കുന്നു.");
  } else {
    s.push("വേനൽ കാലാവസ്ഥയിൽ ഇടയ്ക്ക് മഴയും മേഘാവർദ്ധനവുമാണ് സാധാരണ.");
  }

  // 7. Alerts
  if (imdAlert && imdAlert.text) {
    s.push(`IMD (മലപ്പുറം) ഔദ്യോഗിക അറിയിപ്പ്: ${imdAlert.text} (${imdAlert.lastUpdated || 'ലഭ്യമല്ല'}).`);
  }

  // 8. Local Reports (only description + location)
  s.push("പ്രാദേശിക നിരീക്ഷണങ്ങൾ (Granted) താഴെ ചേർത്തിരിക്കുന്നു:");
  
  return s.join("\n\n");
}


  // Paragraph 5: past hour comparison and trend (3-4 sentences)
  if (computed.tempPrevHour != null && computed.tempNow != null) {
    const diff = (computed.tempNow - computed.tempPrevHour);
    const word = diff > 0 ? "ഉയർന്നു" : (diff < 0 ? "കുറഞ്ഞു" : "മാറ്റമില്ല");
    s.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടെ താപനില ${Math.abs(diff).toFixed(1)}°C ${word}. (മുമ്പ്: ${toFixedSafe(computed.tempPrevHour,1)}°C, ഇപ്പോൾ: ${toFixedSafe(computed.tempNow,1)}°C)`);
  } else {
    s.push("കഴിഞ്ഞ മണിക്കൂറിന്റെ നേരിയ താരതമ്യങ്ങളുടെ രേഖകൾ പര്യാപ്തമല്ല");
  }
  if (computed.tempTrend != null) {
    const trendVal = computed.tempTrend;
    const trendWord = trendVal > 0.15 ? "ഉയരുന്ന പ്രവണത" : (trendVal < -0.15 ? "താഴ്ന്നുവരുന്ന പ്രവണത" : "സ്ഥിരം പ്രവണത");
    s.push(`കഴിഞ്ഞ ${computed.trendHours || 12} മണിക്കൂറുകളിൽ ശരാശരി മാറ്റത്തിന്റെ കണക്കനുസരിച്ച് താപനില ${trendWord} ആയി കാണപ്പെടുന്നു (ഔസതി ${toFixedSafe(trendVal,2)}°C/മണിക്കൂർ).`);
  } else {
    s.push("താപനില бойынша സമഗ്ര പ്രവണതാ കാൽക്കുലേഷൻ സാധിക്കാത്ത സാഹചര്യത്തിലാണ്.");
  }

  // Paragraph 6: seasonal context (2-3 sentences)
  const month = new Date().getMonth() + 1;
  if ([6,7,8,9].includes(month)) {
    s.push("മൂസൂൺ കാലാവസ്ഥാസൂചനകളുമായി ബന്ധപ്പെട്ട വേളയിൽ പ്രവേശിച്ചതുകൊണ്ടു്, വെയിൽക്കും ശക്തമായ മഴക്കുള്ള വ്യതിയാനങ്ങളും ഒരിക്കലും പ്രതീക്ഷാക്കാവുന്നതാണ്.");
  } else if ([10,11,12,1].includes(month)) {
    s.push("ഇത് ശൈതകാല യാത്രയിലേക്കുള്ള കാലയളവിലാണ്; രാത്രികൾ കുറച്ച് തണുപ്പ് അനുഭവപ്പെടുന്നു, പ്രത്യക്ഷമായുള്ള മിഴിവുകൾ കാണപ്പെടാം.");
  } else {
    s.push("ഈ സമയത്ത് പ്രദേശിക കാലാവസ്ഥ സാധാരണയായി മിശ്രമായ ഘടകങ്ങൾ പ്രദർശിപ്പിക്കുന്നു — ഉദയെ മേഘാവഅതും ഇടയ്ക്ക് മഴയും കാണപ്പെടാറുണ്ട്.");
  }

  // Paragraph 7: alerts and AQI (2-3 sentences)
  if (imdAlert && imdAlert.text) {
    s.push(`IMD (മലപ്പുറം) ഔദ്യോഗിക അറിയിപ്പ്: ${imdAlert.text} (അവസാന അപ്‌ഡേറ്റ്: ${imdAlert.lastUpdated || 'ലഭ്യമല്ല'}). ഈ അറിയിപ്പ് മാന്യമായി റിപ്പോർട്ടിൽ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.`);
  } else {
    s.push("IMD-നിന്നുള്ള ഔദ്യോഗിക മാനുവൽ അലേർട് ഈ തീയതിക്ക് രജിസ്റ്റർ ചെയ്തിട്ടില്ല.");
  }
  if (airQuality && (airQuality.aqi != null || airQuality.main != null)) {
    s.push(`വായുനില: AQI ${airQuality.aqi ?? 'ലഭ്യമല്ല'}; പ്രധാന ഘടകം: ${airQuality.main ?? 'ലഭ്യമല്ല'}.`);
  } else {
    s.push("പ്രാദേശിക വായുനില സംബന്ധിച്ച വിശ്വാസയോഗ്യമായ ഡാറ്റ ലഭ്യമല്ല.");
  }

  // Paragraph 8: local observations and user reports (2-4 sentences)
  s.push("പ്രാദേശിക നിരീക്ഷണങ്ങൾക്കും സമൂഹത്തില്‍നിന്നുള്ള റിപ്പോർട്ടുകൾക്കും പ്രധാനപ്പെട്ട സ്ഥാനം ഉണ്ട്. താഴെ ലഭ്യമായ 'Granted' യ userberichte ലംബരൂപങ്ങളായി ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.");

  // Conclusion paragraph (1-2 sentences)
  s.push("സംഗ്രഹമായി, ഇന്നു ഇവിടെ രേഖപ്പെടുത്തിയ അന്തരീക്ഷ നിരീക്ഷണങ്ങളുടെ അടിസ്ഥാനത്തിൽ പ്രദേശികമായി ചില ഭാഗങ്ങളിൽ മേഘാവൃത്തം തുടരാനും സംബദ്ധമായ മഴ സാധ്യതകൾ നിലനിൽക്കും; അതോടൊപ്പം താപനിലയും കാറ്റിന്റെയും ചെറിയ വ്യതിയാനങ്ങൾ പ്രതീക്ഷിക്കാവുന്നതാണ്.");
  s.push("ഈ റിപോർട്ട് മോണിറ്ററിംഗ് ഡാറ്റകളുടെ സംഹിതയാണ്; ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി IMD-യുടെ ഔദ്യോഗിക വിന്യാസങ്ങൾ പരാമർശിക്കുക.");

  // Join and ensure length
  const essay = s.join("\n\n");

  // Guarantee at least ~20 sentences: if shorter, add formal filler sentences to reach size
  const sentenceCount = essay.split(/[.!\?]\s/).filter(Boolean).length;
  if (sentenceCount < 20) {
    const fillers = [
      "വിപരിതമായ മുഴുവൻ വിവരങ്ങളും ലഭ്യമല്ലാത്ത സാഹചര്യത്തിലും പിഴവുകൾ നിർണ്ണയിക്കാനാവില്ല.",
      "കൃത്യമായ നിരീക്ഷണങ്ങൾക്കായി കൂടുതൽ ഡാറ്റ ആവശ്യമാണ്.",
      "പ്രാദേശിക നിരീക്ഷണ കേന്ദ്രങ്ങളുടെ വനിത വിവരങ്ങളും ചേർത്താണ് പശ്ചാത്തലം വിലയിരുത്തുന്നത്."
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

  let meteo = null, owm = null, reports = [];
  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn("Open-Meteo failed", e); }
  try { owm = await fetchOpenWeatherCurrent(); } catch(e){ console.warn("OpenWeather failed", e); }
  try { reports = await fetchGrantedReports(); } catch(e){ reports = []; }

  const computed = meteo ? computeFromMeteo(meteo) : {};
  if (owm) {
    if (computed.humidity == null && owm.main && owm.main.humidity != null) computed.humidity = owm.main.humidity;
    if (computed.windSpeedMs == null && owm.wind && owm.wind.speed != null) computed.windSpeedMs = owm.wind.speed;
    if (computed.windDir == null && owm.wind && owm.wind.deg != null) computed.windDir = owm.wind.deg;
    if (computed.tempNow == null && owm.main && owm.main.temp != null) computed.tempNow = owm.main.temp;
  }

  // airQuality placeholder (not implemented by default)
  const airQuality = null;

  const imdAlert = getImdAlertForToday();

  const essay = generateLongNewsMalayalam({ computed, imdAlert, airQuality });

  // user reports formatting (only include description + location)
  const granted = (reports || []).filter(r => (r.granted && String(r.granted).toLowerCase()==='yes') || (r.show_on_site && String(r.show_on_site).toLowerCase()==='yes'));
  let userHtml = "";
  if (granted.length) {
    const items = granted.map(r => {
      const loc = r.location || r.place || "എലമ്കുളം";
      const desc = (r.observation || r.description || r.obs || r.note || "").trim();
      const time = r.time || (r.timestamp ? new Date(Number(r.timestamp)).toLocaleString() : "");
      if (!desc) return null;
      return `<li>${escapeHtml(loc)} — "${escapeHtml(desc)}"${time ? ` (${escapeHtml(time)})` : ''}</li>`;
    }).filter(Boolean).join("");
    if (items) userHtml = `<div class="imd-alert"><strong>ഉപയോക്തൃ നിരീക്ഷണങ്ങൾ (Granted):</strong><ul class="user-reports">${items}</ul></div>`;
  }

  // final HTML
  const heading = `<h2>${escapeHtml(HEADLINE)}</h2>`;
  const meta = `<div class="meta">${escapeHtml(formatDateMalayalam(new Date()))} — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;
  container.innerHTML = `${heading}${meta}<pre>${escapeHtml(essay)}</pre>${imdAlert && imdAlert.text ? `<div class="imd-alert"><strong>IMD (മലപ്പുറം) അറിയിപ്പ്:</strong> ${escapeHtml(imdAlert.text)} ${imdAlert.lastUpdated ? `(<small>Last updated: ${escapeHtml(imdAlert.lastUpdated)}</small>)` : ''}</div>` : ''}${userHtml}`;
}

// initial run + hourly interval
(async function init(){
  try {
    await runOnceAndRender();
  } catch(e){ console.warn("render error", e); }
  setInterval(() => { try { runOnceAndRender(); } catch(e){ console.warn(e); } }, AUTO_REFRESH_MS);
})();
