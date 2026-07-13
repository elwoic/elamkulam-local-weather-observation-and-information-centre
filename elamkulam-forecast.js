// elamkulam-forecast.js
// Version: News-style, very lengthy Malayalam essay, wind in km/h, constant headline
// + Intelligence layer: real trend/anomaly detection, PM10 fallback, heat-index fallback,
//   synthesized top-alert banner, data-confidence note.
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
// ---------------- REPORT STYLE ----------------
// "mathrubhumi" = formal, editorial
// "radio"       = conversational, short
const REPORT_STYLE = "mathrubhumi";

function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){ return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`; }
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ""; }
function toFixedSafe(v,d=1){ return (v==null||isNaN(Number(v))) ? null : Number(v).toFixed(d); }

function getKeralaSeason(month, rainProb, humidity, recentRainMm) {
  // month: 0 = Jan
  // Use actual recent rainfall as a secondary signal alongside forecast probability,
  // so a wet last few hours can confirm monsoon conditions even if the forecast
  // probability for the exact next hour has dropped.
  const rainSignal = Math.max(rainProb || 0, recentRainMm ? Math.min(100, recentRainMm * 15) : 0);
  if (month >= 5 && month <= 8 && rainSignal >= 40) {
    return "കാലവർഷം"; // Monsoon
  }
  if (month >= 2 && month <= 4 && humidity >= 60) {
    return "ഇടവപ്പാതി"; // Pre-monsoon heat build-up
  }
  if (month >= 9 && month <= 10) {
    return "പോസ്റ്റ്-കാലവർഷം";
  }
  return "സാധാരണ";
}

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

// ---------------- INTELLIGENCE HELPERS ----------------

// Find the hourly index whose timestamp is closest to `target`, instead of
// blindly assuming the last array entry is "now". Open-Meteo returns local
// timestamps (timezone=auto), so plain `new Date(...)` parsing lines up with
// the browser's local clock.
function findClosestTimeIndex(times, target) {
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    const diff = Math.abs(t.getTime() - target.getTime());
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// Heat-index fallback (Rothfusz regression) used only when OpenWeather's
// "feels like" is unavailable. Meant for warm+humid Kerala conditions.
function computeHeatIndexC(tempC, rh) {
  if (tempC == null || rh == null) return null;
  const T = tempC * 9 / 5 + 32;
  const R = rh;
  const HI = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R
    - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R
    + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
  return (HI - 32) * 5 / 9;
}

// Synthesizes the single most important signal of the day from everything
// computed, instead of forcing the reader to piece together separate blocks.
function computeTopAlert({ temp, humidity, rainProb, aqi }) {
  const alerts = [];
  if (temp != null && humidity != null && temp >= 35 && humidity >= 70) {
    alerts.push({ level: 3, text: "ഉയർന്ന ചൂടും ഈർപ്പവും (Heat Stress) ജാഗ്രത" });
  } else if (temp != null && temp >= 32) {
    alerts.push({ level: 2, text: "ചൂട് ജാഗ്രത" });
  }
  if (rainProb >= 70) {
    alerts.push({ level: 3, text: "ശക്തമായ മഴ സാധ്യത" });
  } else if (rainProb >= 30) {
    alerts.push({ level: 1, text: "ചെറിയ മഴ സാധ്യത" });
  }
  if (aqi != null) {
    if (aqi > 200) alerts.push({ level: 3, text: "മോശം വായു ഗുണനിലവാരം" });
    else if (aqi > 100) alerts.push({ level: 2, text: "മിതമായ വായു മലിനീകരണം" });
  }
  if (!alerts.length) return null;
  alerts.sort((a, b) => b.level - a.level);
  return alerts[0].text;
}

// Rain narrative driven by actual measured precipitation (now + rolling
// window), not just the forecast probability — so "it's raining right now"
// and "it might rain later" no longer read identically.
function getRainNarrative(rainProb, precipNow, recentRainMm) {
  if ((precipNow != null && precipNow > 0.2) || (recentRainMm != null && recentRainMm >= 1)) {
    return "നിലവിൽ പ്രദേശത്ത് മഴ പെയ്യുന്നതായി ഡാറ്റ സൂചിപ്പിക്കുന്നു.";
  }
  if (rainProb > 70) {
    return "വരും മണിക്കൂറുകളിൽ മഴ ലഭിക്കാൻ ശക്തമായ സാധ്യതയുണ്ടെന്ന സൂചനകളാണ് കാലാവസ്ഥാ ഡാറ്റ നൽകുന്നത്. " +
           "ഇടിമിന്നലോടുകൂടിയ മഴയായാൽ തുറന്ന പ്രദേശങ്ങളിലുള്ളവർ പ്രത്യേകം ജാഗ്രത പാലിക്കണം.";
  }
  if (rainProb > 30) {
    return "മിതമായ സാധ്യതയിൽ ചെറിയ ചാറ്റൽ മഴ ഉണ്ടാകാമെന്ന പ്രവചനമുണ്ട്. എന്നാൽ ഇത് ദീർഘനേരം തുടരുമെന്നുറപ്പില്ല.";
  }
  return "നിലവിലെ സാഹചര്യത്തിൽ മഴയ്ക്ക് വലിയ സാധ്യതയില്ല. ആകാശം പൊതുവെ തെളിഞ്ഞതോ ഭാഗികമായി മേഘാവൃതമായതോ ആയ നിലയിൽ തുടരും.";
}

// Turns raw tempTrend / tempAnomaly numbers into a sentence, or returns null
// when there isn't enough signal to say anything meaningful.
function getTempTrendNarrative(tempTrend, tempAnomaly) {
  const parts = [];
  if (tempTrend != null) {
    if (tempTrend >= 0.6) parts.push("കഴിഞ്ഞ കുറച്ച് മണിക്കൂറുകളായി താപനില വേഗത്തിൽ ഉയരുന്നതായി കാണുന്നു.");
    else if (tempTrend <= -0.6) parts.push("കഴിഞ്ഞ കുറച്ച് മണിക്കൂറുകളായി താപനില ക്രമേണ കുറയുന്നതായി കാണുന്നു.");
  }
  if (tempAnomaly != null && Math.abs(tempAnomaly) >= 2) {
    if (tempAnomaly > 0) {
      parts.push(`ഇന്നലെ ഇതേ സമയത്തെ അപേക്ഷിച്ച് ഏകദേശം ${toFixedSafe(Math.abs(tempAnomaly),1)}°C കൂടുതൽ ചൂടാണ് ഇന്ന്.`);
    } else {
      parts.push(`ഇന്നലെ ഇതേ സമയത്തെ അപേക്ഷിച്ച് ഏകദേശം ${toFixedSafe(Math.abs(tempAnomaly),1)}°C കുറവാണ് ഇന്നത്തെ താപനില.`);
    }
  }
  return parts.length ? parts.join(" ") : null;
}

// Tells the reader when the report is running on partial data, instead of
// silently presenting an incomplete picture as if it were complete.
function buildDataConfidenceNote({ meteoOk, owmOk, aqiOk }) {
  const missing = [];
  if (!meteoOk) missing.push("Open-Meteo");
  if (!owmOk) missing.push("OpenWeather");
  if (!aqiOk) missing.push("AQI സെൻസർ");
  if (!missing.length) return null;
  return `ശ്രദ്ധിക്കുക: ${missing.join(", ")} ഡാറ്റ ഈ നിമിഷം ലഭ്യമല്ലാത്തതിനാൽ റിപ്പോർട്ടിന്റെ ചില ഭാഗങ്ങൾ പരിമിതമായ വിവരങ്ങളെ അടിസ്ഥാനമാക്കിയാണ്.`;
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

  const now = new Date();
  let meteo=null, owm=null, airQuality=null;
  let meteoOk=true;

  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn(e); meteoOk=false; }
  try { owm = await fetchOpenWeatherCurrent(); } catch(e){ console.warn(e); }
  try { airQuality = await fetchEstimatedAQI(); } catch(e){}

  const computed = meteo ? computeFromMeteo(meteo, now) : {};

  // ---------------- CURRENT WEATHER AUTHORITY ----------------
  // OpenWeather is treated as the source of truth for CURRENT conditions
  if (owm?.main) {
    computed.tempNow = owm.main.temp;
    computed.humidity = owm.main.humidity;
    computed.windSpeedMs = owm.wind?.speed;
    computed.windDir = owm.wind?.deg;
  }

  // --- IMD ALERT BRIDGE (WITH DEFAULT FALLBACK) ---
  let imdAlert = {
    status: "unavailable",
    text: null,
    lastUpdated: null
  };

  if (window.imdAlerts && window.imdLastUpdated) {
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

  const dataConfidenceNote = buildDataConfidenceNote({
    meteoOk,
    owmOk: !!owm,
    aqiOk: !!airQuality
  });

  const essay = generateLongNewsMalayalam({
    computed,
    owmData: owm,
    airQuality,
    imdAlert,
    dataConfidenceNote
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

/* ---------- AQI CALCULATION (PM2.5 / PM10 → AQI, worst pollutant wins) ---------- */

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

function pm10ToAQI(pm) {
  const bp = [
    { cL: 0, cH: 54, aL: 0, aH: 50 },
    { cL: 55, cH: 154, aL: 51, aH: 100 },
    { cL: 155, cH: 254, aL: 101, aH: 150 },
    { cL: 255, cH: 354, aL: 151, aH: 200 },
    { cL: 355, cH: 424, aL: 201, aH: 300 },
    { cL: 425, cH: 604, aL: 301, aH: 500 }
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
    const API_URL = "https://curly-sound-5bea.elwoicelamkulam.workers.dev/api";
    const headers = {
      "x-api-key": "elwoic-secret-2026-xyz"
    };

    const res = await fetch(API_URL, { headers });
    if (!res.ok) return null;

    const data = await res.json();

    const pm25 = data.pm02_corrected ?? null;
    const pm10 = data.pm10_corrected ?? null;

    const aqiFromPM25 = pm25 != null ? pm25ToAQI(pm25) : null;
    const aqiFromPM10 = pm10 != null ? pm10ToAQI(pm10) : null;

    let aqi = null, dominant = null;
    if (aqiFromPM25 != null && aqiFromPM10 != null) {
      if (aqiFromPM25 >= aqiFromPM10) { aqi = aqiFromPM25; dominant = "PM2.5"; }
      else { aqi = aqiFromPM10; dominant = "PM10"; }
    } else if (aqiFromPM25 != null) { aqi = aqiFromPM25; dominant = "PM2.5"; }
    else if (aqiFromPM10 != null) { aqi = aqiFromPM10; dominant = "PM10"; }

    if (aqi == null) return null;

    return {
      aqi,
      pm25,
      pm10,
      dominant,
      status: getAQIStatus(aqi),
      advice: getHealthAdviceMalayalam(aqi),
      source: "ELWOIC Worker API"
    };
  } catch (e) {
    console.warn("fetchEstimatedAQI error", e);
    return null;
  }
}

function computeFromMeteo(m, now = new Date()){
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

    // Anchor to the hour actually closest to "now", not just the last row in
    // the response — with past_days=1 + forecast_days=1 the last row is the
    // final forecast hour of today, not necessarily the current hour.
    const nowIdx = findClosestTimeIndex(times, now);

    const tempNow=temps[nowIdx]??null;
    const tempPrev=nowIdx-1>=0 ? temps[nowIdx-1] : null;

    // Short, responsive trend window (last 3 hours) rather than a 12-hour
    // average, so a fast-moving change shows up quickly.
    const trendHoursWanted=3;
    const trendStart=Math.max(0,nowIdx-trendHoursWanted+1);
    const trendSlice=temps.slice(trendStart,nowIdx+1).filter(v=>v!=null);
    let tempTrend=null;
    if(trendSlice.length>=2) tempTrend=(trendSlice[trendSlice.length-1]-trendSlice[0])/Math.max(1,trendSlice.length-1);

    const precipNow=precip[nowIdx]??null;
    const precipProbNow=precipProb[nowIdx]??null;
    const windNow=windspeed[nowIdx]??null;
    const windDirNow=winddir[nowIdx]??null;
    const humNow=hum[nowIdx]??null;

    // Rolling rain total over the last 3 hours — distinguishes "actively
    // raining / just rained" from a single noisy reading.
    const rainWindowStart=Math.max(0,nowIdx-2);
    const recentRainMm=precip.slice(rainWindowStart,nowIdx+1)
      .filter(v=>v!=null).reduce((a,b)=>a+b,0);

    // Anomaly vs the same hour yesterday, using the past_days=1 data already
    // in this same response.
    const yesterdayIdx = nowIdx-24;
    let tempAnomaly=null;
    if (yesterdayIdx>=0 && temps[yesterdayIdx]!=null && tempNow!=null){
      tempAnomaly = tempNow - temps[yesterdayIdx];
    }

    return { tempNow, tempPrevHour:tempPrev, tempTrend, trendHours:trendSlice.length,
             precipNow, precipProb:precipProbNow, windSpeedMs:windNow, windDir:windDirNow,
             humidity:humNow, recentRainMm, tempAnomaly };
  }catch(e){console.warn("computeFromMeteo", e); return {};}
}

function getHeatImpact({ temp, hour, humidity, windKmh, tempTrend }) {
  if (temp == null) return null;

  const isMidday = hour >= 11 && hour <= 16;
  const humidRisk = humidity != null && humidity >= 60;
  const lowWind = windKmh != null && windKmh < 6;
  const risingFast = tempTrend != null && tempTrend >= 0.6;

  if (temp >= 35 && humidity >= 70) {
    return "ഈ ചൂടും ഉയർന്ന ഈർപ്പവും ചേർന്ന സാഹചര്യത്തിൽ ചൂടേറ്റൽ (Heat Stress) ഉണ്ടാകാൻ സാധ്യതയുള്ളതിനാൽ അധിക ജാഗ്രത ആവശ്യമാണ്.";
  }

  if (temp >= 32 && isMidday && (humidRisk || lowWind || risingFast)) {
    return `താപനില ഏകദേശം ${toFixedSafe(temp,1)}°C ആയതിനാൽ തുറന്ന പ്രദേശങ്ങളിൽ ദീർഘസമയം ചെലവഴിക്കുന്നത് ക്ഷീണത്തിനും ജലക്ഷയത്തിനും ഇടയാക്കാൻ സാധ്യതയുണ്ട്.`;
  }

  if (temp >= 30) {
    return "താപനില ഉയർന്ന നിലയിലായതിനാൽ തുറന്ന പ്രദേശങ്ങളിൽ നിൽക്കുമ്പോൾ ചെറിയ അസ്വസ്ഥത അനുഭവപ്പെടാം.";
  }

  return null;
}

function getHumidityImpact(humidity, hour) {
  if (humidity == null) return null;

  if (humidity >= 70 && hour >= 18) {
    return "സന്ധ്യയോടെ ഉയർന്ന ഈർപ്പനിരക്ക് തുടരുന്നതിനാൽ ഉറക്കത്തിൽ അസ്വസ്ഥത ഉണ്ടാകാൻ സാധ്യതയുണ്ട്.";
  }

  if (humidity >= 65) {
    return "ഉയർന്ന ഈർപ്പനിരക്കിനെ തുടർന്ന് വിയർപ്പ് ശരീരത്തിൽ നിന്ന് പെട്ടെന്ന് ഉണങ്ങാതെ തുടരുന്നു.";
  }

  return null;
}

function getWindImpact(windKmh) {
  if (windKmh == null) return null;

  if (windKmh < 5) {
    return "കാറ്റിന്റെ വേഗത കുറവായതിനാൽ ചൂട് അന്തരീക്ഷത്തിൽ കുടുങ്ങുന്ന അവസ്ഥയാണ് കാണുന്നത്.";
  }

  if (windKmh >= 10) {
    return "മിതമായ കാറ്റ് വീശുന്നതിനാൽ ചില സമയങ്ങളിൽ ചൂടിൽ നിന്ന് ആശ്വാസം ലഭിക്കുന്നു.";
  }

  return null;
}

function styleWrap(text) {
  if (!text) return null;

  if (REPORT_STYLE === "radio") {
    return text
      .replace("സാധ്യതയുണ്ട്.", "എന്ന സൂചനയുണ്ട്.")
      .replace("ആവശ്യമാണ്.", "ശ്രദ്ധിക്കണം.");
  }

  // Mathrubhumi = unchanged, formal
  return text;
}

// ---------------- Essay generator ----------------
function generateLongNewsMalayalam({ computed, owmData, airQuality, imdAlert, dataConfidenceNote }) {
  const now = new Date();
  const hour = now.getHours();
  const s = [];

  const temp = computed.tempNow;
  const humidity = computed.humidity;
  const windKmh = computed.windSpeedMs != null ? msToKmh(computed.windSpeedMs) : null;
  const windDir = computed.windDir != null ? windDirMalayalam(computed.windDir) : null;
  const rainProb = computed.precipProb ?? 0;

  // "Feels like": prefer OpenWeather, fall back to a locally computed heat
  // index when temp+humidity are available but OWM didn't answer.
  let feelsLike = owmData?.main?.feels_like ?? null;
  if (feelsLike == null && temp != null && humidity != null) {
    const hi = computeHeatIndexC(temp, humidity);
    if (hi != null && hi > temp) feelsLike = hi;
  }

  const season = getKeralaSeason(now.getMonth(), rainProb, humidity, computed.recentRainMm);

  /* -------------------------------------------------- */
  /* HEADER */
  s.push(`${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`);
  s.push("--------------------------------------------------");

  /* -------------------------------------------------- */
  /* SYNTHESIZED TOP ALERT — one line combining the day's biggest signal */
  const topAlert = computeTopAlert({ temp, humidity, rainProb, aqi: airQuality?.aqi });
  if (topAlert) s.push(`🔔 ഇന്നത്തെ പ്രധാന സൂചന: ${topAlert}`);

  /* -------------------------------------------------- */
  /* TIME CONTEXT */
  if (season === "ഇടവപ്പാതി") {
    s.push(
      "ഇടവപ്പാതി കാലഘട്ടത്തിന്റെ സ്വഭാവം പ്രകടമായതിനാൽ ചൂടും ഈർപ്പവും ചേർന്ന അസ്വസ്ഥതയാണ് പ്രധാനമായി അനുഭവപ്പെടുന്നത്."
    );
  } else if (season === "കാലവർഷം") {
    s.push(
      "കാലവർഷത്തിന്റെ സ്വാധീനത്തിൽ അന്തരീക്ഷം പെട്ടെന്ന് മാറാവുന്ന അവസ്ഥയിലാണ്."
    );
  }

  if (hour < 9) {
    s.push(
      "രാവിലെ മണിക്കൂറുകളിൽ എലങ്കുളത്ത് അന്തരീക്ഷം പൊതുവെ ശാന്തമായ നിലയിലാണ്. " +
      "രാത്രിയിൽ സഞ്ചയിച്ച ചെറിയ കുളിർമ ഇപ്പോഴും ചില പ്രദേശങ്ങളിൽ അനുഭവപ്പെടുന്നുണ്ടെങ്കിലും, " +
      "സൂര്യൻ ഉയരുന്നതോടെ ഈ തണുപ്പിന്റെ സ്വാധീനം പതുക്കെ കുറയാൻ തുടങ്ങും."
    );
  } else if (hour < 15) {
    s.push(
      "പകൽ സമയം പുരോഗമിക്കുമ്പോൾ സൂര്യന്റെ നേരിട്ടുള്ള സ്വാധീനത്തിൽ ചൂട് ശക്തമാകുന്ന സ്ഥിതിയാണ് കാണുന്നത്. " +
      "തുറന്ന പ്രദേശങ്ങളിലും കോൺക്രീറ്റ് മേൽക്കൂരകളുള്ള ഇടങ്ങളിലുമുള്ളവർക്ക് " +
      "വിയർപ്പും ക്ഷീണവും അനുഭവപ്പെടാൻ സാധ്യത കൂടുതലാണ്."
    );
  } else {
    s.push(
      "സന്ധ്യയോടെ സൂര്യന്റെ ശക്തി കുറയാൻ തുടങ്ങുന്നുണ്ടെങ്കിലും, " +
      "അന്തരീക്ഷത്തിലെ ഈർപ്പം നിലനിൽക്കുന്നതിനാൽ പൂർണ്ണമായ ആശ്വാസം ഉടൻ ലഭിക്കുന്നില്ല. " +
      "ഇത് വൈകുന്നേര സമയത്തെ അസ്വസ്ഥതയ്ക്ക് കാരണമാകാം."
    );
  }

  /* -------------------------------------------------- */
  /* TEMPERATURE + FEELS LIKE */
  if (temp != null) {
    s.push(
      `നിലവിൽ എലങ്കുളത്ത് താപനില ഏകദേശം ${toFixedSafe(temp,1)}°C ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`
    );

    if (humidity != null) {
      s.push(`ഈർപ്പനിരക്ക് ഏകദേശം ${humidity}% ആയി തുടരുന്നു.`);
    }

    if (feelsLike != null) {
      s.push(
        `ശാരീരികമായി അനുഭവപ്പെടുന്ന ചൂട് (Feels Like) ` +
        `${toFixedSafe(feelsLike,1)}°C വരെ എത്തുന്നുവെന്നാണ് വിലയിരുത്തൽ.`
      );
    }
  }

  /* TREND / ANOMALY — new, previously computed but unused */
  const trendText = getTempTrendNarrative(computed.tempTrend, computed.tempAnomaly);
  if (trendText) s.push(trendText);

  const heatText = getHeatImpact({ temp, hour, humidity, windKmh, tempTrend: computed.tempTrend });
  if (heatText) s.push(styleWrap(heatText));

  const humidityText = getHumidityImpact(humidity, hour);
  if (humidityText) s.push(styleWrap(humidityText));

  const windText = getWindImpact(windKmh);
  if (windText) s.push(styleWrap(windText));

  /* -------------------------------------------------- */
  /* WIND */
  if (windKmh != null && windDir) {
    s.push(
      `ഏകദേശം ${toFixedSafe(windKmh,1)} km/h വേഗതയിൽ ` +
      `${windDir} ദിശയിൽ നിന്നാണ് കാറ്റ് വീശുന്നത്.`
    );
  }

  /* -------------------------------------------------- */
  /* RAIN ANALYSIS — now grounded in actual measured precipitation too */
  s.push(getRainNarrative(rainProb, computed.precipNow, computed.recentRainMm));

  /* -------------------------------------------------- */
  /* AIR QUALITY */
  if (airQuality) {
    s.push(
      `ഇന്നത്തെ വായു ഗുണനിലവാര സൂചിക (AQI) ${airQuality.aqi} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു ` +
      `(${airQuality.status.text} ${airQuality.status.emoji})` +
      (airQuality.dominant ? `, പ്രധാന കാരണം ${airQuality.dominant}.` : ".")
    );

    if (airQuality.pm25 != null) {
      s.push(`PM2.5 അളവ് ഏകദേശം ${toFixedSafe(airQuality.pm25,1)} µg/m³ ആണ്.`);
    }
    if (airQuality.pm10 != null) {
      s.push(`PM10 അളവ് ഏകദേശം ${toFixedSafe(airQuality.pm10,1)} µg/m³ ആണ്.`);
    }

    s.push(
      `ആരോഗ്യപരമായ നിർദ്ദേശം: ${airQuality.advice} ` +
      "പ്രത്യേകിച്ച് ശ്വാസകോശ സംബന്ധമായ പ്രശ്നങ്ങളുള്ളവർ കൂടുതൽ ശ്രദ്ധ പാലിക്കേണ്ടതാണ്."
    );
  }

  /* -------------------------------------------------- */
  /* PUBLIC ADVICE */
  s.push(
    "💡 **പൊതുജന നിർദ്ദേശം:**\n" +
    "ഉച്ച സമയങ്ങളിൽ നേരിട്ട് സൂര്യപ്രകാശം ഏറ്റുവാങ്ങുന്ന പ്രവർത്തനങ്ങൾ പരിമിതപ്പെടുത്തുക. " +
    "ധാരാളം വെള്ളം കുടിക്കുക. കുട്ടികളും വയോധികരും അധിക ചൂട് അനുഭവപ്പെടുന്ന സാഹചര്യങ്ങളിൽ " +
    "വിശ്രമം ഉറപ്പാക്കുന്നത് ആരോഗ്യപരമായി ഗുണകരമായിരിക്കും."
  );

  /* -------------------------------------------------- */
  /* IMD ALERT */
  if (imdAlert) {
    if (imdAlert.status === "available" && imdAlert.text) {
      s.push(
        `⚠️ **ഔദ്യോഗിക മുന്നറിയിപ്പ് (IMD):**\n` +
        `കേന്ദ്ര കാലാവസ്ഥാ വകുപ്പിന്റെ അറിയിപ്പ് പ്രകാരം പ്രദേശത്ത് ` +
        `${imdAlertMalayalamMeaning(
          imdAlert.text.match(/[oyrg]$/i)?.[0] || "g"
        )} നിലവിലാണ്.\n` +
        `അവസാനം പുതുക്കിയത്: ${imdAlert.lastUpdated}`
      );
    } else if (imdAlert.status === "no-today-data") {
      s.push(
        "ℹ️ **IMD അറിയിപ്പ്:**\n" +
        "ഇന്നത്തെ ദിവസത്തേക്കുള്ള പ്രത്യേക മുന്നറിയിപ്പ് നിലവിൽ ഇല്ല. " +
        "സ്ഥിതി സാധാരണ നിലയിലായിരിക്കാനാണ് സാധ്യത."
      );
    }
  }

  /* -------------------------------------------------- */
  /* DATA CONFIDENCE NOTE */
  if (dataConfidenceNote) s.push(dataConfidenceNote);

  s.push("--------------------------------------------------");
  s.push(
    "കുറിപ്പ്: ഈ റിപ്പോർട്ട് വിവിധ ഔദ്യോഗിക കാലാവസ്ഥാ ഡാറ്റ സ്രോതസ്സുകളെ അടിസ്ഥാനമാക്കി " +
    "ഓട്ടോമേറ്റഡ് രീതിയിൽ തയ്യാറാക്കിയതാണ്. പ്രാദേശിക സാഹചര്യങ്ങൾ അനുസരിച്ച് " +
    "കാലാവസ്ഥയിൽ പെട്ടെന്ന് മാറ്റങ്ങൾ സംഭവിക്കാവുന്നതാണ്."
  );

  return s.join("\n\n");
}

// ---------------- Initialize ----------------
(async function init(){
  try{ await runOnceAndRender(); }catch(e){console.warn("render error",e);}
  setInterval(()=>{ try{ runOnceAndRender();}catch(e){console.warn(e);} }, AUTO_REFRESH_MS);
})();
