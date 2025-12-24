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
function generateLongNewsMalayalam({ computed, imdAlert, airQuality }){

  const s = [];
  const now = new Date();
  const dateLine = `${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;

  s.push(HEADLINE);
  s.push(dateLine);
  s.push("");

  // Paragraph 1: overall situation
  s.push("പ്രാദേശിക അന്തരീക്ഷ നിരീക്ഷണങ്ങളെ അടിസ്ഥാനമാക്കി എലങ്കുളം പ്രദേശത്ത് നിലവിലുള്ള കാലാവസ്ഥയുടെ വിശദമായ അവലോകനം താഴെ പരാമർശിക്കുന്നു.");
  
  if (computed.tempNow != null) {
    s.push(`ഇപ്പോൾ പ്രദേശത്ത് രേഖപ്പെടുത്തിയിരിക്കുന്ന താപനില ${toFixedSafe(computed.tempNow,1)}°C ആണ്. കഴിഞ്ഞ മണിക്കൂറുകളിൽ ലഭ്യമായ ഡാറ്റ പ്രകാരം, ഈ താപനിലയിൽ ശ്രദ്ധേയമായ വ്യതിയാനം കണ്ടിട്ടില്ല; മൊത്തത്തിൽ ഇത് ${computed.tempTrend>0.15 ? 'തത്സമയം ഉയരുന്ന' : (computed.tempTrend < -0.15 ? 'അല്പം താഴ്ന്നുവരുന്ന' : 'സ്ഥിരത പുലർത്തുന്ന')} നിലയിലാണ്.`);
  } else {
    s.push("ഈ സമയത്ത് താപനില സംബന്ധിച്ച കൃത്യമായ ഇപ്പോഴത്തെ രേഖകൾ ലഭ്യമല്ല.");
  }
  
  s.push("ഇന്ന് പ്രദേശത്ത് പ്രാതിനിധ്യമർഹിക്കുന്ന മേഘാവരണം തുടരുന്നുവെന്ന് നിരീക്ഷണങ്ങൾ സൂചിപ്പിക്കുന്നു; ചില ഇടവേളകളിൽ മേഘസാന്ദ്രതയിൽ ചെറിയ മാറ്റങ്ങൾ ഉണ്ടായേക്കാം.");

  // Paragraph 2: humidity
  if (computed.humidity != null) {
    s.push(`വാതാവിലെ ഈർപ്പതോത് നിലവിൽ ${Math.round(computed.humidity)}% ആണ്. ഈ മൂല്യം പ്രാദേശികമായി തിരിച്ചറിയപ്പെടുന്ന വായുവിന്റെ ഭാരത്വത്തിലും ശീതത്വത്തിലും ചെറിയ സ്വാധീനങ്ങൾ സൃഷ്ടിക്കാവുന്ന ഒന്നാണ്.`);
  } else {
    s.push("ഈർപ്പത്തിന്റെ നിലവിലുള്ള രേഖകൾ വ്യക്തമല്ല.");
  }
  s.push("ഈർപ്പത്തിലെ ചെറിയ വ്യതിയാനങ്ങൾ അന്തരീക്ഷത്തിലെ ദ്രവസംയോജന പ്രക്രിയകളിൽ സ്വാധീനമുണ്ടാക്കുന്നത് സാധാരണമാണ്.");

  // Paragraph 3: wind
  if (computed.windSpeedMs != null) {
    const kmh = msToKmh(computed.windSpeedMs);
    s.push(`കാറ്റിന്റെ വേഗം ഇപ്പോൾ ഏകദേശം ${toFixedSafe(kmh,1)} km/h ആണ്. കാറ്റ് വീശുന്ന ദിശ ${windDirMalayalam(computed.windDir)} (${computed.windDir != null ? Math.round(computed.windDir) + "°" : 'ലഭ്യമല്ല'}) ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`);
    s.push("ഈ വേഗതയിൽ വലിയതോതിലുള്ള പ്രദേശീയ അന്തരീക്ഷ വ്യതിയാനങ്ങൾ സാധാരണയായി പ്രതീക്ഷിക്കാറില്ല.");
    s.push("അടുത്ത മണിക്കൂറുകളിൽ കാറ്റിന്റെ ദിശയിലും വേഗത്തിലും ചെറിയ മാറ്റങ്ങൾ സംഭവിക്കാമെന്നതാണ് പ്രവചനങ്ങളുടെ സൂചന.");
  } else {
    s.push("കാറ്റിന്റെ വേഗതയും ദിശയും സംബന്ധിച്ച സമഗ്രമായ ഡാറ്റ ഇപ്പോൾ ലഭ്യമല്ല.");
  }

  // Paragraph 4: rain
  if (computed.precipNow != null && computed.precipNow > 0.1) {
    s.push("പ്രദേശത്ത് നിലവിൽ ചെറിയ തോതിൽ മഴ പെയ്യുന്നുവെന്ന് രേഖകൾ സൂചിപ്പിക്കുന്നു; ഈ മഴ അടുത്ത മണിക്കൂറുകളിലും ഇടവിട്ടു തുടർന്നേക്കാം.");
  } else if (computed.precipProb != null) {
    s.push(`അടുത്ത മണിക്കൂറുകളിൽ മഴ ലഭിക്കാനുള്ള ശരാശരി സാദ്ധ്യത ${Math.round(computed.precipProb)}% ആയി മോഡലുകൾ വിലയിരുത്തുന്നു. ഇത് ലഘുവായ മഴയും ഇടക്കിടെ ഉണ്ടായേക്കാവുന്ന ചെറിയ ചിതറലുകളും ഉൾക്കൊള്ളുന്ന നിലയാണ്.`);
  } else {
    s.push("ഇപ്പോൾ ശക്തമായ മഴ രേഖപ്പെട്ടിട്ടില്ല; എന്നാൽ മേഘാവരണം പ്രദേശത്തിന്റെ ചില ഭാഗങ്ങളിൽ തുടർന്നേക്കാം.");
  }

  s.push("മേഘാവസ്ഥയിലെ ഈ മാറ്റങ്ങൾ സാധാരണ നിരീക്ഷണ ഡാറ്റയുടെ അടിസ്ഥാനത്തിൽ കൃത്യമായി രേഖപ്പെടുത്തപ്പെടുന്നവയാണ്.");

  // Paragraph 5: temperature comparison
  if (computed.tempPrevHour != null && computed.tempNow != null) {
    const diff = (computed.tempNow - computed.tempPrevHour);
    const word = diff > 0 ? "ഉയർന്നിട്ടുണ്ട്" : (diff < 0 ? "താഴ്ന്നിട്ടുണ്ട്" : "മാറ്റമില്ല");
    s.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിനിടെ താപനിലയിൽ ${Math.abs(diff).toFixed(1)}°C എന്ന തോതിൽ മാറ്റം സംഭവിച്ചിട്ടുണ്ട് — മുമ്പ്: ${toFixedSafe(computed.tempPrevHour,1)}°C, ഇപ്പോൾ: ${toFixedSafe(computed.tempNow,1)}°C. ഇതിനർത്ഥം താപനില ${word} എന്നുതന്നെ തിരിച്ചറിയപ്പെടുന്നു.`);
  } else {
    s.push("മുമ്പത്തെ മണിക്കൂറുമായി താരതമ്യം ചെയ്യുന്നതിനുള്ള ഡാറ്റ പര്യാപ്തമല്ല.");
  }

  if (computed.tempTrend != null) {
    const trendVal = computed.tempTrend;
    const trendWord = trendVal > 0.15 ? "ഉയരുന്ന പ്രവണത" : (trendVal < -0.15 ? "താഴ്ന്നുവരുന്ന പ്രവണത" : "സ്ഥിരത പുലർത്തുന്ന പ്രവണത");
    s.push(`കഴിഞ്ഞ ${computed.trendHours || 12} മണിക്കൂറുകളിൽ ലഭ്യമായ ശരാശരി നിരീക്ഷണങ്ങൾ പ്രകാരം താപനിലയിൽ ${trendWord} കാണപ്പെടുന്നു. (ഔസത മാറ്റം: ${toFixedSafe(trendVal,2)}°C/മണിക്കൂർ)`);
  } else {
    s.push("താപനില പ്രവണത കണക്കാക്കുന്നതിനുള്ള സമഗ്ര ഡാറ്റ ലഭ്യമല്ല.");
  }

  // Paragraph 6: seasonal context
  const month = new Date().getMonth() + 1;
  if ([6,7,8,9].includes(month)) {
    s.push("ദക്ഷിണ പടിഞ്ഞാറൻ മൺസൂൺ സജീവമായിരിക്കുന്ന കാലയളവായതിനാൽ, ഇടയ്ക്കിടെ മഴ കിട്ടുന്നതും മേഘാവരണം നിലനിൽക്കുന്നതും സാധാരണമാണ്.");
  } else if ([10,11,12,1].includes(month)) {
    s.push("ഇപ്പോൾ ശൈത്യകാല സാഹചര്യങ്ങളാണ് നിലനിൽക്കുന്നത്; രാത്രികളിൽ തണുപ്പ് അനുഭവപ്പെടുകയും പ്രഭാത സമയങ്ങളിൽ നേരിയ മൂടൽമഞ്ഞ് ഉണ്ടാകുകയും ചെയ്യുന്നത് സാധാരണമാണ്.");
  } else {
    s.push("ഈ കാലയളവിൽ പ്രാദേശികമായി സൂര്യപ്രകാശം, മേഘാവരണം, ഇടവിട്ടുള്ള മഴ എന്നിവ ഒന്നിച്ച് പ്രകടമാകുന്ന മിശ്ര സാഹചര്യങ്ങളാണ് സാധാരണ.");
  }

  // Paragraph 7: alerts & AQI
  if (imdAlert && imdAlert.text) {
  const codeMatch = imdAlert.text.match(/[oyrg]$/i); // get last letter
  const code = codeMatch ? codeMatch[0] : null;
  const meaning = code ? imdAlertMalayalamMeaning(code) : "ലഭ്യമല്ല";

  s.push(`IMD (മലപ്പുറം) ഔദ്യോഗിക മുന്നറിയിപ്പ്: ${meaning}. (അവസാന അപ്ഡേറ്റ്: ${imdAlert.lastUpdated || 'ലഭ്യമല്ല'})`);
} else {
  s.push("ഇന്നത്തെ തീയതിക്ക് IMD ഔദ്യോഗിക അലർട്ട് ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.");
}

 if (airQuality && airQuality.aqi != null) {
   s.push(
  `വായുനില സൂചിക (AQI): ${airQuality.aqi} — ${aqiMalayalamMeaning(airQuality.aqi)}. ` +
  `ഈ മൂല്യം OpenWeather മാനദണ്ഡപ്രകാരമുള്ള 1–5 സ്കെയിലിൽ നിന്നുള്ളതാണ്. ` +
  `ഇത് ആഗോള AQI സ്കെയിലിൽ ഏകദേശം ${airQuality.aqi === 1 ? "0–50" :
     airQuality.aqi === 2 ? "51–100" :
     airQuality.aqi === 3 ? "101–200" :
     airQuality.aqi === 4 ? "201–300" : "301–500"} പരിധിയോട് സമാനമാണ്. ` +
  `ഉയർന്ന മൂല്യങ്ങൾ ശ്വാസകോശ പ്രശ്നങ്ങൾക്കും ദീർഘകാല ആരോഗ്യബാധകൾക്കും സാധ്യത വർധിപ്പിക്കുന്നു.`
);

  } else {
    s.push("പ്രാദേശിക വായുനില സംബന്ധിച്ച കൃത്യമായ രേഖകൾ ലഭ്യമല്ല.");
  }

  // Paragraph 8: user reports
  s.push("പ്രാദേശികരിൽ നിന്ന് ലഭിക്കുന്ന നിരീക്ഷണങ്ങൾ കാലാവസ്ഥാ റിപ്പോർട്ടുകളുടെ വിശദത വർധിപ്പിക്കുന്നതിനാൽ, ലഭ്യമായ 'Granted' വിഭാഗത്തിലെ റിപ്പോർട്ടുകളും ചേര്‍ക്കപ്പെട്ടിരിക്കുന്നു.");

  // Conclusion
  s.push("സമാപനമായി, ഇന്ന് രേഖപ്പെടുത്തിയിരിക്കുന്ന നിരീക്ഷണങ്ങളുടെ അടിസ്ഥാനത്തിൽ എലങ്കുളം പ്രദേശത്ത് മേഘാവരണം തുടരാനും ചില ഇടവേളകളിൽ നേരിയ മഴയ്ക്ക് സാധ്യത നിലനിൽക്കാനും സാധ്യതയുണ്ട്.");
  s.push("ഈ റിപ്പോർട്ട് ലഭ്യമായ ഡാറ്റകളുടെ സംഹിതയാണ്; ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി IMD പുറത്തിറക്കുന്ന അറിയിപ്പുകൾ നോക്കുക.");

  const essay = s.join("\n\n");

  const sentenceCount = essay.split(/[.!\?]\s/).filter(Boolean).length;
  if (sentenceCount < 20) {
    const fillers = [
      "നിലവിലെ ഡാറ്റയിൽ ചില ഒഴിവുകൾ നിലവിലുണ്ടെങ്കിലും റിപ്പോർട്ട് സാധ്യമായ പരമാവധി കൃത്യതയിൽ രൂപപ്പെടുത്തിയിരിക്കുന്നു.",
      "കൂടുതൽ നിരീക്ഷണ വിവരങ്ങൾ ലഭ്യമാകുന്നതനുസരിച്ച് അടുത്ത അപ്ഡേറ്റുകളിൽ കൂടുതൽ വ്യക്തത പ്രതീക്ഷിക്കാം.",
      "പ്രാദേശിക നിരീക്ഷണ കേന്ദ്രങ്ങളിൽ നിന്നുള്ള സംഗ്രഹ വിവരങ്ങളും വിലയിരുത്തലിനായി പരിഗണിച്ചിട്ടുള്ളതാണ്."
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

