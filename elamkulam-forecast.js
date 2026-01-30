        // elamkulam-forecast.js
// Version: News-style, very lengthy Malayalam essay, wind in km/h, constant headline
// Usage: place <div id="elamkulam-forecast-report"></div> in your page and include:
// <script type="module" src="elamkulam-forecast.js">

// ---------------- CONFIG ----------------
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const LAT = 10.9081;
const LON = 76.2296;
const CONTAINER_ID = "elamkulam-forecast-report";
const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour
const HEADLINE = "എലങ്കുളം കാലാവസ്ഥാ സമഗ്ര റിപ്പോർട്ട്";
const MONTHS_ML = ["ജനുവരി","ഫെബ്രുവരി","മാർച്ച്","ഏപ്രിൽ","മേയ്","ജൂൺ","ജൂലൈ","ഓഗസ്റ്റ്","സെപ്റ്റംബർ","ഒക്ടോബർ","നവംബർ","ഡിസംബർ"];

function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){ return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`; }
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ""; }
function toFixedSafe(v,d=1){ return (v==null||isNaN(Number(v))) ? null : Number(v).toFixed(d); }
function msToKmh(ms){ return (ms==null||isNaN(ms)) ? null : ms * 3.6; }
function windDirMalayalam(deg){ 
  if(deg==null||isNaN(deg)) return "ലഭ്യമല്ല"; 
  const dirs=["ഉത്തര","ഉത്തര-കിഴക്ക്","കിഴക്ക്","തെക്ക്-കിഴക്ക്","തെക്ക്","തെക്ക്-പശ്ചിമ","പശ്ചിമ","വടക്ക്-പശ്ചിമ"]; 
  return dirs[Math.round(deg/45)%8]; 
}
function imdAlertMalayalamMeaning(code){
  const map={g:"Green (No warning) സുരക്ഷിതമായ അന്തരീക്ഷം (Safe)",
             y:"Yellow (Watch) മിതമായ ജാഗ്രത (Moderate Alert)",
             o:"Orange (Alert) മോശം, ജാഗ്രത ആവശ്യമുണ്ട് (Severe Alert)",
             r:"Red (Warning) അതി മോശം, കരുതലോടെ പ്രവർത്തിക്കുക (Very Severe Alert)"};
  return map[code.toLowerCase()]||"ലഭ്യമല്ല";
}
function aqiMalayalamMeaning(aqi){
  const map={1:"നല്ലത് (Good) — 0–50",2:"മിതമായത് (Fair) — 51–100",3:"മധ്യമം (Moderate) — 101–200",
             4:"മോശം (Poor) — 201–300",5:"അതിമോശം (Very Poor) — 301–500"};
  return map[aqi]||"ലഭ്യമല്ല";
}

// ---------------- Inject Malayalam font ----------------
(function injectFont(){
  const href="https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;600&display=swap";
  if(!document.querySelector(`link[href="${href}"]`)){
    const link=document.createElement('link'); link.rel='stylesheet'; link.href=href; document.head.appendChild(link);
  }
  if(!document.getElementById('elam-forecast-style')){
    const s=document.createElement('style'); s.id='elam-forecast-style';
    s.innerHTML=`
      #${CONTAINER_ID} { font-family:'Noto Sans Malayalam', system-ui, -apple-system, "Segoe UI", Roboto, Arial; color:#111; background:#fff; padding:14px; border-radius:6px; line-height:1.6; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
      #${CONTAINER_ID} h2 { margin:0 0 6px 0; font-size:1.3rem; font-weight:600; }
      #${CONTAINER_ID} .meta { color:#555; font-size:1rem; margin-bottom:8px; }
      #${CONTAINER_ID} pre { white-space: pre-wrap; font-family: inherit; margin:0; font-size:1rem; }
      #${CONTAINER_ID} .imd-alert { margin-top:10px; font-size:1rem; color:#111; }
      #${CONTAINER_ID} .user-reports { margin-top:10px; font-size:1rem; padding-left:18px; }
    `;
    document.head.appendChild(s);
  }
})();
async function runOnceAndRender(){
  const container = document.getElementById(CONTAINER_ID);
  if(!container){
    console.warn("Container not found:", CONTAINER_ID);
    return;
  }

  container.innerHTML = `<div class="meta">അപ്‌ഡേറ്റ് ചെയ്യുന്നു…</div>`;

  let meteo=null, owm=null, airQuality=null;

  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn(e); }
  try { owm = await fetchOpenWeatherCurrent(); } catch(e){ console.warn(e); }
  try { airQuality = await fetchEstimatedAQI(); } catch(e){}

  const computed = meteo ? computeFromMeteo(meteo) : {};

  // fallback from OpenWeather
  if (owm?.main) {
    if (computed.tempNow == null) computed.tempNow = owm.main.temp;
    if (computed.humidity == null) computed.humidity = owm.main.humidity;
    if (computed.windSpeedMs == null) computed.windSpeedMs = owm.wind?.speed;
    if (computed.windDir == null) computed.windDir = owm.wind?.deg;
  }
// --- IMD ALERT BRIDGE ---
// --- IMD ALERT BRIDGE (WITH DEFAULT FALLBACK) ---
let imdAlert = {
  status: "unavailable",
  text: null,
  lastUpdated: null
};

if (window.imdAlerts && window.imdLastUpdated) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  imdAlert.lastUpdated = window.imdLastUpdated;

  if (window.imdAlerts[todayKey]) {
    imdAlert.status = "available";
    imdAlert.text = window.imdAlerts[todayKey].text;
  } else {
    imdAlert.status = "no-today-data";
  }
} else {
  imdAlert.status = "fetch-failed";
}


 const essay = generateLongNewsMalayalam({
  computed,
  owmData: owm,
  airQuality,
  imdAlert
});


  container.innerHTML = `
    <h2>${HEADLINE}</h2>
    <div class="meta">${formatDateMalayalam(new Date())} — ${formatTimeMalayalam(new Date())}</div>
    <pre>${escapeHtml(essay)}</pre>
  `;
}

// ---------------- Fetch functions ----------------
async function fetchOpenMeteoHourly(lat=LAT, lon=LON){
  const params=new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    hourly:"temperature_2m,relativehumidity_2m,precipitation,precipitation_probability,windspeed_10m,winddirection_10m,cloudcover",
    past_days:"1",
    forecast_days:"1"
  });
  const url=`${OPEN_METEO_BASE}?${params.toString()}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error("Open-Meteo fetch failed: "+r.status);
  return r.json();
}

async function fetchOpenWeatherCurrent(lat=LAT, lon=LON){
  if(!OPENWEATHER_API_KEY) return null;
  const p=new URLSearchParams({ lat, lon, appid:OPENWEATHER_API_KEY, units:"metric" });
  const url=`https://api.openweathermap.org/data/2.5/weather?${p.toString()}`;
  try{
    const r=await fetch(url);
    if(!r.ok){ console.warn("OpenWeather failed", r.status); return null; }
    return r.json();
  }catch(e){ console.warn("OpenWeather error", e); return null; }
}

/* ---------- AQI CALCULATION (PM2.5 → AQI) ---------- */

function pm25ToAQI(pm) {
  const bp = [
    { cL: 0, cH: 12, aL: 0, aH: 50 },
    { cL: 12.1, cH: 35.4, aL: 51, aH: 100 },
    { cL: 35.5, cH: 55.4, aL: 101, aH: 150 },
    { cL: 55.5, cH: 150.4, aL: 151, aH: 200 },
    { cL: 150.5, cH: 250.4, aL: 201, aH: 300 },
    { cL: 250.5, cH: 500, aL: 301, aH: 500 }
  ];
  for (const r of bp) {
    if (pm >= r.cL && pm <= r.cH) {
      return Math.round(
        ((r.aH - r.aL) / (r.cH - r.cL)) * (pm - r.cL) + r.aL
      );
    }
  }
  return null;
}

function getAQIStatus(aqi) {
  if (aqi <= 50) return { text: "നല്ലത്", emoji: "😀" };
  if (aqi <= 100) return { text: "തൃപ്തികരം", emoji: "🙂" };
  if (aqi <= 200) return { text: "മിതമായ മലിനീകരണം", emoji: "😐" };
  if (aqi <= 300) return { text: "മോശം", emoji: "😷" };
  return { text: "അതിമോശം", emoji: "☹️" };
}

function getHealthAdviceMalayalam(aqi) {
  if (aqi <= 50)
    return "വായു ഗുണനിലവാരം വളരെ നല്ലതാണ്. പുറംപ്രവർത്തനങ്ങൾക്ക് അനുയോജ്യം.";
  if (aqi <= 100)
    return "സാധാരണ ആളുകൾക്ക് സുരക്ഷിതം. എന്നാൽ സെൻസിറ്റീവ് വിഭാഗങ്ങൾ ജാഗ്രത പാലിക്കുക.";
  if (aqi <= 200)
    return "ദീർഘനേരം പുറത്ത് പ്രവർത്തിക്കുന്നത് കുറയ്ക്കുന്നത് നല്ലതാണ്.";
  if (aqi <= 300)
    return "പുറംപ്രവർത്തനങ്ങൾ പരിമിതപ്പെടുത്തുക.";
  return "പുറംപ്രവർത്തനങ്ങൾ ഒഴിവാക്കുന്നത് ശക്തമായി ശുപാർശ ചെയ്യുന്നു.";
}

async function fetchEstimatedAQI() {
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality` +
      `?latitude=${LAT}&longitude=${LON}&current=pm2_5`;

    const res = await fetch(url);
    const data = await res.json();

    const pm25 = data?.current?.pm2_5;
    if (pm25 == null) return null;

    const aqi = pm25ToAQI(pm25);
    if (aqi == null) return null;

    return {
      aqi,
      pm25,
      status: getAQIStatus(aqi),
      advice: getHealthAdviceMalayalam(aqi),
      source: "Estimated (Open-Meteo)"
    };
  } catch (e) {
    return null;
  }
}


function computeFromMeteo(m){
  try{
    const h=m.hourly||{};
    const times=h.time||[];
    const temps=h.temperature_2m||[];
    const hum=h.relativehumidity_2m||[];
    const precip=h.precipitation||[];
    const precipProb=h.precipitation_probability||[];
    const windspeed=h.windspeed_10m||[];
    const winddir=h.winddirection_10m||[];
    if(!times.length) return {};
    const last=times.length-1;
    const tempNow=temps[last]??null;
    const tempPrev=last-1>=0 ? temps[last-1] : null;
    const hours=12;
    const start=Math.max(0,last-hours+1);
    const slice=temps.slice(start,last+1).filter(v=>v!=null);
    let trend=null;
    if(slice.length>=2) trend=(slice[slice.length-1]-slice[0])/Math.max(1,slice.length-1);
    const precipNow=precip[last]??null;
    const precipProbNow=precipProb[last]??null;
    const windNow=windspeed[last]??null;
    const windDirNow=winddir[last]??null;
    const humNow=hum[last]??null;
    return { tempNow, tempPrevHour:tempPrev, tempTrend:trend, trendHours:slice.length,
             precipNow, precipProb:precipProbNow, windSpeedMs:windNow, windDir:windDirNow, humidity:humNow };
  }catch(e){console.warn("computeFromMeteo", e); return {};}
}

// ---------------- Essay generator ----------------
// elamkulam-forecast.js - Mega Essay Version
// Version: Expanded News-Style Journalistic Report

// ... (Keep your existing CONFIG and UTILS as they were) ...

function generateLongNewsMalayalam({ computed, owmData, airQuality, imdAlert }) {
  const now = new Date();
  const hour = now.getHours();
  const s = [];

  const temp = computed.tempNow;
  const humidity = computed.humidity;
  const windKmh = computed.windSpeedMs != null ? msToKmh(computed.windSpeedMs) : null;
  const feelsLike = owmData?.main?.feels_like ?? null;
  const rainProb = computed.precipProb ?? 0;

  // --------------------------------------------------
  // HEADLINE
  
  s.push(`${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`);
  s.push("--------------------------------------------------");

  // --------------------------------------------------
  // TIME-BASED OPENING (VERY HUMAN)
  if (hour < 9) {
    s.push(
      "രാവിലെ എലങ്കുളത്ത് അന്തരീക്ഷം പൊതുവെ ശാന്തമാണ്. രാത്രി ശേഷിച്ച കുളിർമ ഇപ്പോഴും ഭാഗികമായി അനുഭവപ്പെടുന്നുണ്ടെങ്കിലും, സൂര്യൻ ഉയരുന്നതോടെ ചൂട് പതുക്കെ ശക്തിയാർജ്ജിക്കാൻ തുടങ്ങും."
    );
  } else if (hour < 15) {
    s.push(
      "പകൽ സമയം പുരോഗമിക്കുമ്പോൾ എലങ്കുളത്ത് സൂര്യന്റെ ചൂട് ശക്തമായി അനുഭവപ്പെടുന്നു. തുറന്ന പ്രദേശങ്ങളിൽ നിൽക്കുമ്പോൾ ശരീരത്തിന് വിയർപ്പും ക്ഷീണവും തോന്നാൻ സാധ്യതയുണ്ട്."
    );
  } else {
    s.push(
      "സന്ധ്യയോടെ ദിവസത്തെ കടുത്ത ചൂട് കുറയാൻ തുടങ്ങി. എന്നാൽ അന്തരീക്ഷത്തിലെ ഈർപ്പം തുടരുന്നതിനാൽ പൂർണ്ണമായ ആശ്വാസം ലഭിക്കാൻ ഇനിയും സമയം എടുത്തേക്കും."
    );
  }

  // --------------------------------------------------
  // TEMPERATURE + BODY FEEL
  if (temp != null) {
    let heatDesc = "സാധാരണ നിലയിലുള്ള";
    if (temp >= 34) heatDesc = "കടുത്ത";
    else if (temp >= 30) heatDesc = "കൂടുതൽ";
    else if (temp <= 24) heatDesc = "താരതമ്യേന കുറഞ്ഞ";

    let bodyFeel = "ശരീരത്തിന് സഹിക്കാവുന്ന തരത്തിലുള്ള ചൂടാണ്";
    if (humidity >= 75) bodyFeel = "വിയർപ്പും അസ്വസ്ഥതയും ഉണ്ടാക്കുന്ന ചൂടാണ്";
    else if (humidity <= 45) bodyFeel = "വരണ്ട ചൂടായി അനുഭവപ്പെടുന്നു";

    s.push(
      `നിലവിൽ എലങ്കുളത്ത് ${heatDesc} ചൂടാണ് അനുഭവപ്പെടുന്നത്. താപനില ഏകദേശം ${toFixedSafe(temp, 1)}°C ആണ്. ഈർപ്പനിരക്കിന്റെ സ്വാധീനത്തിൽ ഇത് ${bodyFeel}.`
    );

    if (feelsLike != null && Math.abs(feelsLike - temp) >= 2) {
      s.push(
        `ശാരീരികമായി അനുഭവപ്പെടുന്ന ചൂട് (Feels Like) ${toFixedSafe(feelsLike, 1)}°C വരെ എത്തുന്നുണ്ട്.`
      );
    }
  }

  // --------------------------------------------------
  // WIND & COMFORT
  if (windKmh != null) {
    if (windKmh < 5) {
      s.push(
        "കാറ്റിന്റെ വേഗത കുറവായതിനാൽ ചൂടിൽ നിന്നും വലിയ ആശ്വാസം ലഭിക്കുന്നില്ല."
      );
    } else {
      s.push(
        `മിതമായ വേഗതയിൽ (${toFixedSafe(windKmh, 1)} km/h) കാറ്റ് വീശുന്നതിനാൽ ചില സമയങ്ങളിൽ ചെറിയ തണുപ്പു അനുഭവപ്പെടുന്നു.`
      );
    }
  }

  // --------------------------------------------------
  // RAIN – HUMAN PREDICTION STYLE
  if (rainProb > 70) {
    s.push(
      "വരും മണിക്കൂറുകളിൽ മഴ ലഭിക്കാൻ ശക്തമായ സാധ്യതയുണ്ട്. ഇടിയോടുകൂടിയ മഴയാണെങ്കിൽ തുറന്ന പ്രദേശങ്ങളിൽ ഉള്ളവർ ജാഗ്രത പാലിക്കണം."
    );
  } else if (rainProb > 30) {
    s.push(
      "ചെറിയ തോതിലുള്ള മഴ ലഭിക്കാമെന്ന സൂചനകളുണ്ട്. എന്നാൽ ഇത് ദീർഘനേരം തുടരാനുള്ള സാധ്യത കുറവാണ്."
    );
  } else {
    s.push(
      "ഇന്നത്തെ സാഹചര്യത്തിൽ മഴയ്ക്ക് വലിയ സാധ്യതയില്ല. ആകാശം പൊതുവെ തെളിഞ്ഞ നിലയിലാണ്."
    );
  }

  // --------------------------------------------------
  // AIR QUALITY – HEALTH TONE
 // --------------------------------------------------
// AIR QUALITY – REAL AQI WITH ADVICE
if (airQuality) {
  s.push(
    `വായു ഗുണനിലവാര സൂചിക (AQI) ഇന്ന് ${airQuality.aqi} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു ` +
    `(${airQuality.status.text} ${airQuality.status.emoji}). ` +
    `PM2.5 അളവ് ഏകദേശം ${toFixedSafe(airQuality.pm25, 1)} µg/m³ ആണ്.\n\n` +
    `ആരോഗ്യ നിർദ്ദേശം: ${airQuality.advice}`
  );
}


  // --------------------------------------------------
  // PUBLIC ADVICE – VERY IMPORTANT
  s.push(
    "💡 **പൊതുജന നിർദ്ദേശം:**\nഉച്ച സമയങ്ങളിൽ നേരിട്ട് സൂര്യപ്രകാശം ഏറ്റുവാങ്ങുന്ന പ്രവർത്തനങ്ങൾ ഒഴിവാക്കുക. ധാരാളം വെള്ളം കുടിക്കുക. രാവിലെ അല്ലെങ്കിൽ വൈകുന്നേരം നടക്കുന്ന ചെറിയ നടക്കൽ ശരീരത്തിന് ഗുണകരമായിരിക്കും."
  );

  // --------------------------------------------------
  // IMD ALERT (IF ANY)
 // --------------------------------------------------
// IMD ALERT – OFFICIAL STATUS (WITH FALLBACK TEXT)
if (imdAlert) {
  if (imdAlert.status === "available" && imdAlert.text) {
    s.push(
      `⚠️ **ഔദ്യോഗിക മുന്നറിയിപ്പ് (IMD):**\n` +
      `കേന്ദ്ര കാലാവസ്ഥാ വകുപ്പിന്റെ ഏറ്റവും പുതിയ അറിയിപ്പ് പ്രകാരം പ്രദേശത്ത് ` +
      `${imdAlertMalayalamMeaning(
        imdAlert.text.match(/[oyrg]$/i)?.[0] || "g"
      )} നിലവിലാണ്.\n` +
      `അവസാനം പുതുക്കിയത്: ${imdAlert.lastUpdated}`
    );
  }

  else if (imdAlert.status === "no-today-data") {
    s.push(
      "ℹ️ **IMD അറിയിപ്പ്:**\n" +
      "ഇന്നത്തെ ദിവസത്തേക്കുള്ള പ്രത്യേക കാലാവസ്ഥാ മുന്നറിയിപ്പ് നിലവിൽ ലഭ്യമല്ല. " +
      "സ്ഥിതി സാധാരണ നിലയിലായിരിക്കാനാണ് സാധ്യത."
    );
  }

  else if (imdAlert.status === "fetch-failed") {
    s.push(
      "ℹ️ **IMD അറിയിപ്പ്:**\n" +
      "കേന്ദ്ര കാലാവസ്ഥാ വകുപ്പിന്റെ മുന്നറിയിപ്പ് ഡാറ്റ ഇപ്പോൾ ലഭ്യമാക്കാൻ സാധിച്ചില്ല. " +
      "ഡാറ്റ ലഭ്യമാകുന്നുണ്ടെങ്കിൽ റിപ്പോർട്ടിൽ സ്വയം ഉൾപ്പെടുത്തുന്നതാണ്."
    );
  }
}

  // --------------------------------------------------
  // FOOTER
  s.push("--------------------------------------------------");
  s.push(
    "കുറിപ്പ്: ഈ റിപ്പോർട്ട് നിലവിലെ കാലാവസ്ഥാ ഡാറ്റയെ അടിസ്ഥാനമാക്കി ഓട്ടോമേറ്റഡ് രീതിയിൽ തയ്യാറാക്കിയതാണ്. കാലാവസ്ഥയിൽ പെട്ടെന്ന് മാറ്റങ്ങൾ സംഭവിക്കാം."
  );

  return s.join("\n\n");
}

// ---------------- Initialize ----------------
(async function init(){
  try{ await runOnceAndRender(); }catch(e){console.warn("render error",e);}
  setInterval(()=>{ try{ runOnceAndRender();}catch(e){console.warn(e);} }, AUTO_REFRESH_MS);
})();
