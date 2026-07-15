// elamkulam-forecast.js
// Version: News-style Malayalam essay, powered by the ELWOIC core atmospheric engine
// (station data + air quality + trends + 24h history) plus Open-Meteo for forward rain
// probability only. Sentences are chosen from variant pools each run so the output
// doesn't read like the same template every hour.
// Usage: place <div id="elamkulam-forecast-report"></div> in your page and include:
// <script type="module" src="elamkulam-forecast.js">

// ---------------- CONFIG ----------------
const CORE_API_URL = "https://elwoic-core-for-public-side.elwoicelamkulam.workers.dev/";
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

// ---------------- BASIC HELPERS ----------------
function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){ return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`; }
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function formatTimeIST(ms){
  if (ms == null) return null;
  return new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
}
function escapeHtml(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ""; }
function toFixedSafe(v,d=1){ return (v==null||isNaN(Number(v))) ? null : Number(v).toFixed(d); }
// Picks a random phrasing from a pool so the same fact doesn't read identically every run.
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

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

// Find the record with the max/min value of `field` in an array of history records.
function findExtreme(records, field, mode){
  let best=null;
  for (const r of records){
    const v = r?.[field];
    if (v==null) continue;
    if (best==null) best=r;
    else if (mode==="max" && v>best[field]) best=r;
    else if (mode==="min" && v<best[field]) best=r;
  }
  return best;
}

function fallbackSeasonFromMonth(month){ // 1-12, used only if core is unreachable
  if ([3,4,5].includes(month)) return "premonsoon";
  if ([6,7,8,9].includes(month)) return "southwest_monsoon";
  if ([10,11].includes(month)) return "post_monsoon";
  return "dry_season";
}

// Blends the core engine's authoritative season enum with local humidity/rain signal
// to pick a Malayalam narrative bucket (adds the ഇടവപ്പാതി distinction on top of premonsoon).
function mapCoreSeasonToNarrativeBucket(coreSeason, humidity, rainSignal){
  if (coreSeason === "southwest_monsoon" && rainSignal >= 40) return "കാലവർഷം";
  if (coreSeason === "premonsoon" && humidity != null && humidity >= 60) return "ഇടവപ്പാതി";
  if (coreSeason === "post_monsoon") return "പോസ്റ്റ്-കാലവർഷം";
  return "സാധാരണ";
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
    if (pm >= r.cL && pm <= r.cH) return Math.round(((r.aH - r.aL) / (r.cH - r.cL)) * (pm - r.cL) + r.aL);
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
    if (pm >= r.cL && pm <= r.cH) return Math.round(((r.aH - r.aL) / (r.cH - r.cL)) * (pm - r.cL) + r.aL);
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
  let meteo=null, coreRaw=null;
  let meteoOk=true;

  try { meteo = await fetchOpenMeteoHourly(); } catch(e){ console.warn(e); meteoOk=false; }
  try { coreRaw = await fetchCoreAtmosphericData(); } catch(e){ console.warn(e); }

  const rainForecast = meteo ? computeRainForecast(meteo, now) : { rainProbNow: 0, rainProbNext3h: 0 };
  const core = computeFromCore(coreRaw);

  // --- IMD ALERT BRIDGE (unchanged) ---
  let imdAlert = { status: "unavailable", text: null, lastUpdated: null };

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

  const dataConfidenceNote = buildDataConfidenceNote({ coreOk: !!core, meteoOk });

  const essay = generateLongNewsMalayalam({ core, rainForecast, imdAlert, dataConfidenceNote, now });

  container.innerHTML = `
    <h2>${HEADLINE}</h2>
    <div class="meta">${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}</div>
    <pre>${escapeHtml(essay)}</pre>
  `;
}

// ---------------- Fetch functions ----------------

// The core engine already gives current conditions + air quality + trends + 24h
// history in one call, gated by Origin (elwoic.in / info.elwoic.in / request.elwoic.in).
async function fetchCoreAtmosphericData(){
  try {
    const res = await fetch(CORE_API_URL);
    if (!res.ok) { console.warn("Core engine fetch failed", res.status); return null; }
    const data = await res.json();
    if (data && data.success === false) { console.warn("Core engine error:", data.error); return null; }
    return data;
  } catch(e){ console.warn("Core engine fetch error", e); return null; }
}

// Open-Meteo is kept only for forward-looking rain probability — the core engine
// has real-time + history but no forecast.
async function fetchOpenMeteoHourly(lat=LAT, lon=LON){
  const params=new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    hourly: "precipitation_probability",
    forecast_days: "1"
  });
  const url=`${OPEN_METEO_BASE}?${params.toString()}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error("Open-Meteo fetch failed: "+r.status);
  return r.json();
}

function findClosestTimeIndex(times, target) {
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    const diff = Math.abs(t.getTime() - target.getTime());
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

function computeRainForecast(m, now){
  try {
    const times = m?.hourly?.time || [];
    const probs = m?.hourly?.precipitation_probability || [];
    if (!times.length) return { rainProbNow: 0, rainProbNext3h: 0 };
    const idx = findClosestTimeIndex(times, now);
    const rainProbNow = probs[idx] ?? 0;
    const windowEnd = Math.min(times.length-1, idx+3);
    const windowProbs = probs.slice(idx, windowEnd+1).filter(v=>v!=null);
    const rainProbNext3h = windowProbs.length
      ? Math.round(windowProbs.reduce((a,b)=>a+b,0)/windowProbs.length)
      : rainProbNow;
    return { rainProbNow, rainProbNext3h };
  } catch(e){ return { rainProbNow: 0, rainProbNext3h: 0 }; }
}

// ---------------- CORE PACKET → FLAT COMPUTED VALUES ----------------
function computeFromCore(core){
  if (!core) return null;

  const temp = core.thermal?.outdoor?.temperature ?? null;
  const feelsLike = core.thermal?.outdoor?.feelsLike ?? null;
  const dewPoint = core.thermal?.outdoor?.dewPoint ?? null;
  const humidity = core.moisture?.outdoor?.humidity ?? null;

  const windSpeedKmh = core.wind?.speed ?? null;
  const windGustKmh = core.wind?.gust ?? null;
  const windDirDeg = core.wind?.directionDegrees ?? null;
  const windDirML = windDirDeg != null ? windDirMalayalam(windDirDeg) : null;

  const solar = core.radiation?.solar ?? null;
  const uvi = core.radiation?.uvi ?? null;
  const pressureRel = core.pressure?.relative ?? null;

  const rainRateNow = core.precipitation?.rainRate ?? null;
  const dailyRain = core.precipitation?.dailyRain ?? null;
  const hourlyRain = core.precipitation?.hourlyRain ?? null;

  const pm25 = core.airQuality?.pm25 ?? null;
  const pm10 = core.airQuality?.pm10 ?? null;
  const co2 = core.airQuality?.co2 ?? null;

  const trends = core.trends || {};
  const tempTrend1h = trends.thermal?.outdoorTemp1h ?? null;
  const pressureTrend3h = trends.pressure?.relative3h ?? null;
  const pm25Trend1h = trends.airQuality?.pm25Change1h ?? null;

  const last24h = core.history?.last24h || [];
  const maxTempRec = findExtreme(last24h, 'outdoor_temp', 'max');
  const minTempRec = findExtreme(last24h, 'outdoor_temp', 'min');
  const maxGustRec = findExtreme(last24h, 'wind_gust', 'max');

  let tempAnomaly24h = null;
  if (last24h.length && last24h[0].outdoor_temp != null && temp != null) {
    tempAnomaly24h = Number((temp - last24h[0].outdoor_temp).toFixed(1));
  }

  const aqiFromPM25 = pm25 != null ? pm25ToAQI(pm25) : null;
  const aqiFromPM10 = pm10 != null ? pm10ToAQI(pm10) : null;
  let aqi = null, dominant = null;
  if (aqiFromPM25 != null && aqiFromPM10 != null) {
    if (aqiFromPM25 >= aqiFromPM10) { aqi = aqiFromPM25; dominant = "PM2.5"; }
    else { aqi = aqiFromPM10; dominant = "PM10"; }
  } else if (aqiFromPM25 != null) { aqi = aqiFromPM25; dominant = "PM2.5"; }
  else if (aqiFromPM10 != null) { aqi = aqiFromPM10; dominant = "PM10"; }

  return {
    temp, feelsLike, dewPoint, humidity,
    windSpeedKmh, windGustKmh, windDirML,
    solar, uvi, pressureRel,
    rainRateNow, dailyRain, hourlyRain,
    pm25, pm10, co2, aqi, dominant,
    tempTrend1h, pressureTrend3h, pm25Trend1h, tempAnomaly24h,
    maxTempRec, minTempRec, maxGustRec,
    season: core.meta?.season ?? null,
    hourIST: core.meta?.hourIST ?? null,
    daytime: core.meta?.daytime ?? null
  };
}

// ---------------- NARRATIVE BUILDERS ----------------

function computeTopAlert({ temp, humidity, aqi, pressureTrend3h, rainRateNow, rainProbNow }) {
  const alerts = [];
  if (temp != null && humidity != null && temp >= 35 && humidity >= 70) {
    alerts.push({ level: 3, text: "ഉയർന്ന ചൂടും ഈർപ്പവും (Heat Stress) ജാഗ്രത" });
  } else if (temp != null && temp >= 32) {
    alerts.push({ level: 2, text: "ചൂട് ജാഗ്രത" });
  }
  if (rainRateNow != null && rainRateNow > 0) {
    alerts.push({ level: 3, text: "നിലവിൽ മഴ പെയ്യുന്നു" });
  } else if (rainProbNow >= 70) {
    alerts.push({ level: 2, text: "ശക്തമായ മഴ സാധ്യത" });
  } else if (rainProbNow >= 30) {
    alerts.push({ level: 1, text: "ചെറിയ മഴ സാധ്യത" });
  }
  if (aqi != null) {
    if (aqi > 200) alerts.push({ level: 3, text: "മോശം വായു ഗുണനിലവാരം" });
    else if (aqi > 100) alerts.push({ level: 2, text: "മിതമായ വായു മലിനീകരണം" });
  }
  if (pressureTrend3h != null && pressureTrend3h <= -2) {
    alerts.push({ level: 2, text: "മർദ്ദം കുറയുന്നു — കാലാവസ്ഥാ മാറ്റ സാധ്യത" });
  }
  if (!alerts.length) return null;
  alerts.sort((a, b) => b.level - a.level);
  return alerts[0].text;
}

function buildDataConfidenceNote({ coreOk, meteoOk }) {
  const missing = [];
  if (!coreOk) missing.push("ELWOIC സ്റ്റേഷൻ ഡാറ്റ");
  if (!meteoOk) missing.push("മഴ പ്രവചന ഡാറ്റ");
  if (!missing.length) return null;
  return `ശ്രദ്ധിക്കുക: ${missing.join(", ")} ഈ നിമിഷം ലഭ്യമല്ലാത്തതിനാൽ റിപ്പോർട്ടിന്റെ ചില ഭാഗങ്ങൾ പരിമിതമായ വിവരങ്ങളെ അടിസ്ഥാനമാക്കിയാണ്.`;
}

function buildDewPointNarrative(dewPoint){
  if (dewPoint == null) return null;
  // Thresholds calibrated to Kerala's actual range — coastal dew points rarely
  // exceed ~26°C even in peak monsoon, so "very muggy" has to start well below that
  // or it never fires and everything gets flattened into a meaningless middle bucket.
  if (dewPoint >= 24) return pick([
    "മഞ്ഞുബിന്ദു നില (Dew Point) വളരെ ഉയർന്നതിനാൽ അന്തരീക്ഷം കനത്ത, അസ്വസ്ഥജനകമായ ഈർപ്പത്തോടെയാണ് അനുഭവപ്പെടുന്നത്.",
    "ഈർപ്പത്തിന്റെ യഥാർത്ഥ അളവുകോലായ മഞ്ഞുബിന്ദു നില (Dew Point) വളരെ ഉയർന്നതിനാൽ അന്തരീക്ഷത്തിൽ ഈർപ്പം വളരെ കനത്തതായി അനുഭവപ്പെടുന്നു."
  ]);
  if (dewPoint >= 20) return pick([
    "മഞ്ഞുബിന്ദു നില (Dew Point) ശ്രദ്ധേയമായ ഈർപ്പം സൂചിപ്പിക്കുന്നു.",
    "അന്തരീക്ഷത്തിൽ മിതമായതിലധികം ഈർപ്പം അനുഭവപ്പെടാൻ സാധ്യതയുള്ള നിലയാണ് ഇപ്പോഴത്തെ മഞ്ഞുബിന്ദു നില (Dew Point)."
  ]);
  return null; // genuinely comfortable — no need to say anything
}

function buildTempNarrative(temp, humidity, feelsLike, dewPoint){
  if (temp == null) return [];
  const lines = [];
  lines.push(pick([
    `നിലവിൽ എലങ്കുളത്ത് താപനില ഏകദേശം ${toFixedSafe(temp,1)}°C ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
    `എലങ്കുളത്തെ ഇപ്പോഴത്തെ താപനില ഏകദേശം ${toFixedSafe(temp,1)}°C ആണ്.`
  ]));
  if (humidity != null) {
    lines.push(pick([
      `ഈർപ്പനിരക്ക് ഏകദേശം ${humidity}% ആയി തുടരുന്നു.`,
      `അന്തരീക്ഷ ഈർപ്പം ഏകദേശം ${humidity}% നിലയിലാണ്.`
    ]));
  }
  if (feelsLike != null && Math.abs(feelsLike - temp) >= 0.5) {
    lines.push(pick([
      `ശാരീരികമായി അനുഭവപ്പെടുന്ന ചൂട് (Feels Like) ${toFixedSafe(feelsLike,1)}°C വരെ എത്തുന്നുവെന്നാണ് വിലയിരുത്തൽ.`,
      `യഥാർത്ഥത്തിൽ അനുഭവപ്പെടുന്ന ചൂട് ഏകദേശം ${toFixedSafe(feelsLike,1)}°C ആണ്.`
    ]));
  }
  const dewText = buildDewPointNarrative(dewPoint);
  if (dewText) lines.push(dewText);
  return lines;
}

function getTempTrendNarrative(tempTrend1h, tempAnomaly24h) {
  const parts = [];
  if (tempTrend1h != null) {
    if (tempTrend1h >= 0.6) parts.push(pick([
      "കഴിഞ്ഞ ഒരു മണിക്കൂറിനുള്ളിൽ താപനില വേഗത്തിൽ ഉയരുന്നതായി കാണുന്നു.",
      "അടുത്ത കുറച്ച് സമയത്തിനുള്ളിൽ താപനില ദ്രുതഗതിയിൽ കൂടിയിട്ടുണ്ട്."
    ]));
    else if (tempTrend1h <= -0.6) parts.push(
      "കഴിഞ്ഞ ഒരു മണിക്കൂറിനുള്ളിൽ താപനില ക്രമേണ കുറയുന്നതായി കാണുന്നു."
    );
  }
  if (tempAnomaly24h != null && Math.abs(tempAnomaly24h) >= 2) {
    if (tempAnomaly24h > 0) {
      parts.push(`ഇന്നലെ ഇതേ സമയത്തെ അപേക്ഷിച്ച് ഏകദേശം ${toFixedSafe(Math.abs(tempAnomaly24h),1)}°C കൂടുതൽ ചൂടാണ് ഇപ്പോൾ.`);
    } else {
      parts.push(`ഇന്നലെ ഇതേ സമയത്തെ അപേക്ഷിച്ച് ഏകദേശം ${toFixedSafe(Math.abs(tempAnomaly24h),1)}°C കുറവാണ് ഇപ്പോഴത്തെ താപനില.`);
    }
  }
  return parts.length ? parts.join(" ") : null;
}

function getHeatImpact({ temp, hour, humidity, windKmh, tempTrend }) {
  if (temp == null) return null;
  const isMidday = hour >= 11 && hour <= 16;
  const humidRisk = humidity != null && humidity >= 60;
  const lowWind = windKmh != null && windKmh < 6;
  const risingFast = tempTrend != null && tempTrend >= 0.6;

  if (temp >= 35 && humidity >= 70) {
    return pick([
      "ഈ ചൂടും ഉയർന്ന ഈർപ്പവും ചേർന്ന സാഹചര്യത്തിൽ ചൂടേറ്റൽ (Heat Stress) ഉണ്ടാകാൻ സാധ്യതയുള്ളതിനാൽ അധിക ജാഗ്രത ആവശ്യമാണ്.",
      "കടുത്ത ചൂടും ഈർപ്പവും ചേർന്നതിനാൽ ശരീരത്തിന് ചൂട് പുറന്തള്ളാൻ ബുദ്ധിമുട്ടുള്ള അവസ്ഥയാണ്; ജാഗ്രത ആവശ്യമാണ്."
    ]);
  }
  if (temp >= 32 && isMidday && (humidRisk || lowWind || risingFast)) {
    return pick([
      `താപനില ഏകദേശം ${toFixedSafe(temp,1)}°C ആയതിനാൽ തുറന്ന പ്രദേശങ്ങളിൽ ദീർഘസമയം ചെലവഴിക്കുന്നത് ക്ഷീണത്തിനും ജലക്ഷയത്തിനും ഇടയാക്കാൻ സാധ്യതയുണ്ട്.`,
      `ഏകദേശം ${toFixedSafe(temp,1)}°C ചൂടിൽ ഉച്ചസമയത്ത് തുറസ്സായ സ്ഥലങ്ങളിൽ ജോലി ചെയ്യുന്നവർ ഇടയ്ക്ക് വിശ്രമിക്കുന്നത് നല്ലതാണ്.`
    ]);
  }
  if (temp >= 30) {
    return pick([
      "താപനില ഉയർന്ന നിലയിലായതിനാൽ തുറന്ന പ്രദേശങ്ങളിൽ നിൽക്കുമ്പോൾ ചെറിയ അസ്വസ്ഥത അനുഭവപ്പെടാം.",
      "ചൂട് അല്പം കൂടുതലായതിനാൽ പുറത്ത് കൂടുതൽ നേരം നിൽക്കുന്നത് ചെറിയ ക്ഷീണം ഉണ്ടാക്കിയേക്കാം."
    ]);
  }
  return null;
}

function getHumidityImpact(humidity, hour, warm) {
  if (humidity == null) return null;
  // "Warm" (feels-like >= 28°C) gates the discomfort claims — humidity alone at a
  // mild feels-like is just a humid evening, not a sleep-disturbance risk.
  if (humidity >= 70 && hour >= 18 && warm) {
    return pick([
      "സന്ധ്യയോടെ ഉയർന്ന ഈർപ്പനിരക്കും ചൂടും ചേർന്ന് ഉറക്കത്തിൽ അസ്വസ്ഥത ഉണ്ടാകാൻ സാധ്യതയുണ്ട്.",
      "രാത്രിയിലും ചൂടും ഈർപ്പവും ഉയർന്ന നിലയിൽ തുടരാൻ സാധ്യതയുള്ളതിനാൽ അന്തരീക്ഷം അല്പം അസ്വസ്ഥകരമായി തോന്നാം."
    ]);
  }
  if (humidity >= 65 && warm) {
    return pick([
      "ഉയർന്ന ഈർപ്പനിരക്കിനെ തുടർന്ന് വിയർപ്പ് ശരീരത്തിൽ നിന്ന് പെട്ടെന്ന് ഉണങ്ങാതെ തുടരുന്നു.",
      "ഈർപ്പം കൂടുതലായതിനാൽ ചൂട് കൂടുതൽ കടുപ്പമുള്ളതായി അനുഭവപ്പെടാം."
    ]);
  }
  if (humidity >= 80) {
    // High humidity but mild feels-like: worth noting, not worth alarming about.
    return pick([
      "ഈർപ്പനിരക്ക് ഉയർന്ന നിലയിലാണെങ്കിലും താപനില മിതമായതിനാൽ വലിയ അസ്വസ്ഥത പ്രതീക്ഷിക്കേണ്ടതില്ല.",
      "ഈർപ്പം കൂടുതലാണെങ്കിലും ചൂട് കുറവായതിനാൽ അന്തരീക്ഷം സഹനീയമാണ്."
    ]);
  }
  return null;
}

function getWindImpact(windKmh, warm) {
  if (windKmh == null) return null;
  if (windKmh < 5 && warm) {
    return pick([
      "കാറ്റിന്റെ വേഗത കുറവായതിനാൽ ചൂട് അന്തരീക്ഷത്തിൽ കുടുങ്ങുന്ന അവസ്ഥയാണ് കാണുന്നത്.",
      "കാറ്റ് മിക്കവാറും നിശ്ചലമായതിനാൽ ചൂടിന് വലിയ ആശ്വാസം ലഭിക്കുന്നില്ല."
    ]);
  }
  if (windKmh >= 10 && warm) {
    return pick([
      "മിതമായ കാറ്റ് വീശുന്നതിനാൽ ചില സമയങ്ങളിൽ ചൂടിൽ നിന്ന് ആശ്വാസം ലഭിക്കുന്നു.",
      "കാറ്റിന് നല്ല വേഗതയുള്ളതിനാൽ പുറത്ത് നിൽക്കുന്നവർക്ക് ചൂടിൽ ഒരു ആശ്വാസം അനുഭവപ്പെടും."
    ]);
  }
  return null;
}

function buildWindNarrative(speedKmh, gustKmh, dirML){
  if (speedKmh == null) return null;
  // Below this, direction is noise — a station reading of ~0 km/h has no
  // meaningful direction to report, so don't manufacture one.
  if (speedKmh < 1.5) {
    return pick([
      "കാറ്റ് ഏതാണ്ട് നിശ്ചലമായ അവസ്ഥയിലാണ്.",
      "നിലവിൽ ശ്രദ്ധേയമായ കാറ്റ് അനുഭവപ്പെടുന്നില്ല."
    ]);
  }
  const dirLabel = dirML || "അജ്ഞാത ദിശ";
  const lines = [pick([
    `ഏകദേശം ${toFixedSafe(speedKmh,1)} km/h വേഗതയിൽ ${dirLabel} ദിശയിൽ നിന്ന് കാറ്റ് വീശുന്നു.`,
    `${dirLabel} ദിശയിൽ നിന്ന് ഏകദേശം ${toFixedSafe(speedKmh,1)} km/h വേഗതയിൽ കാറ്റ് അനുഭവപ്പെടുന്നു.`
  ])];
  if (gustKmh != null && (gustKmh - speedKmh) >= 8) {
    lines.push(`ഇടയ്ക്കിടെ ${toFixedSafe(gustKmh,1)} km/h വരെ എത്തുന്ന ശക്തമായ കാറ്റിന്റെ കുതിപ്പുകളും (gusts) അനുഭവപ്പെടുന്നുണ്ട്.`);
  }
  return lines.join(" ");
}

function buildPressureNarrative(pressureRel, pressureTrend3h){
  if (pressureRel == null) return null;
  const lines = [`അന്തരീക്ഷമർദ്ദം ഏകദേശം ${toFixedSafe(pressureRel,1)} hPa ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`];
  if (pressureTrend3h != null) {
    if (pressureTrend3h <= -1.5) lines.push(pick([
      "കഴിഞ്ഞ മൂന്ന് മണിക്കൂറിനുള്ളിൽ മർദ്ദം ശ്രദ്ധേയമായി താഴ്ന്നിട്ടുണ്ട്, ഇത് കാലാവസ്ഥയിൽ മാറ്റം സൂചിപ്പിക്കാം.",
      "മർദ്ദത്തിലെ കുറവ് സമീപ മണിക്കൂറുകളിൽ അന്തരീക്ഷം അസ്ഥിരമാകാനുള്ള സാധ്യത നൽകുന്നു."
    ]));
    else if (pressureTrend3h >= 1.5) lines.push(
      "മർദ്ദം സമീപ മണിക്കൂറുകളിൽ ഉയരുന്നതായി കാണുന്നു, ഇത് സ്ഥിരതയുള്ള അന്തരീക്ഷത്തെ സൂചിപ്പിക്കുന്നു."
    );
  }
  return lines.join(" ");
}

function buildSolarNarrative(solar, uvi, daytime){
  if (!daytime) return null;
  if (uvi == null && solar == null) return null;
  if (uvi != null && uvi >= 8) {
    return "അൾട്രാവയലറ്റ് സൂചിക (UVI) " + toFixedSafe(uvi,1) + " എന്ന ഉയർന്ന നിലയിലാണ്; നേരിട്ട് വെയിലേൽക്കുന്നത് പരിമിതപ്പെടുത്തുന്നത് നല്ലതാണ്.";
  }
  if (uvi != null && uvi >= 5) {
    return `അൾട്രാവയലറ്റ് സൂചിക (UVI) ഏകദേശം ${toFixedSafe(uvi,1)} ആയി മിതമായ നിലയിലാണ്.`;
  }
  return null;
}

function getRainNarrative(rainRateNow, hourlyRain, dailyRain, rainProbNow, rainProbNext3h) {
  const lines = [];
  if (rainRateNow != null && rainRateNow > 0) {
    lines.push(pick([
      `നിലവിൽ ഏകദേശം ${toFixedSafe(rainRateNow,1)} mm/hr നിരക്കിൽ മഴ പെയ്യുന്നതായി സ്റ്റേഷൻ ഡാറ്റ കാണിക്കുന്നു.`,
      `ഇപ്പോൾ പ്രദേശത്ത് മഴ പെയ്യുന്നുണ്ട്, നിരക്ക് ഏകദേശം ${toFixedSafe(rainRateNow,1)} mm/hr ആണ്.`
    ]));
    if (hourlyRain != null && hourlyRain > 0) {
      lines.push(`ഈ മണിക്കൂറിൽ ഇതുവരെ ഏകദേശം ${toFixedSafe(hourlyRain,1)} mm മഴ ലഭിച്ചു.`);
    }
  } else {
    if (rainProbNow >= 70) {
      lines.push("വരും മണിക്കൂറുകളിൽ മഴ ലഭിക്കാൻ ശക്തമായ സാധ്യതയുണ്ടെന്ന് പ്രവചന ഡാറ്റ സൂചിപ്പിക്കുന്നു. ഇടിമിന്നലോടുകൂടിയ മഴയായാൽ തുറന്ന പ്രദേശങ്ങളിലുള്ളവർ പ്രത്യേകം ജാഗ്രത പാലിക്കണം.");
    } else if (rainProbNow >= 30) {
      lines.push("മിതമായ സാധ്യതയിൽ ചെറിയ ചാറ്റൽ മഴ ഉണ്ടാകാമെന്ന പ്രവചനമുണ്ട്.");
    } else {
      lines.push("നിലവിലെ സാഹചര്യത്തിൽ മഴയ്ക്ക് വലിയ സാധ്യതയില്ല.");
    }
    if (rainProbNext3h != null && (rainProbNext3h - rainProbNow) >= 20) {
      lines.push("അടുത്ത കുറച്ച് മണിക്കൂറുകളിൽ മഴ സാധ്യത വർധിക്കുന്നതായി കാണുന്നു.");
    } else if (rainProbNext3h != null && (rainProbNow - rainProbNext3h) >= 20) {
      lines.push("മഴ സാധ്യത ക്രമേണ കുറയുന്നതായി കാണുന്നു.");
    }
  }
  if (dailyRain != null && dailyRain > 0) {
    lines.push(`ഇന്ന് ഇതുവരെ ആകെ ഏകദേശം ${toFixedSafe(dailyRain,1)} mm മഴ രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`);
  }
  return lines.join(" ");
}

function buildDailyExtremesNarrative(maxTempRec, minTempRec, maxGustRec){
  const lines = [];
  if (maxTempRec?.outdoor_temp != null) {
    lines.push(`കഴിഞ്ഞ 24 മണിക്കൂറിനുള്ളിൽ രേഖപ്പെടുത്തിയ ഏറ്റവും ഉയർന്ന താപനില ${toFixedSafe(maxTempRec.outdoor_temp,1)}°C ആണ് (${formatTimeIST(maxTempRec._parsedTimestamp)} സമയത്ത്).`);
  }
  if (minTempRec?.outdoor_temp != null) {
    lines.push(`ഏറ്റവും കുറഞ്ഞ താപനില ${toFixedSafe(minTempRec.outdoor_temp,1)}°C ആയിരുന്നു (${formatTimeIST(minTempRec._parsedTimestamp)} സമയത്ത്).`);
  }
  if (maxGustRec?.wind_gust != null) {
    lines.push(`ഏറ്റവും ശക്തമായ കാറ്റിന്റെ കുതിപ്പ് ${toFixedSafe(maxGustRec.wind_gust,1)} km/h ആയി രേഖപ്പെടുത്തി (${formatTimeIST(maxGustRec._parsedTimestamp)} സമയത്ത്).`);
  }
  return lines.length ? lines.join(" ") : null;
}

// Graded, threshold-correct AQI advice — the respiratory-caution line only shows up
// when the AQI is actually elevated (>100), instead of being tacked onto every report
// regardless of how clean the air is.
function buildAqiNarrative(pm25, pm10, co2, aqi, dominant, pm25Trend1h) {
  const lines = [];
  if (aqi == null) return lines;
  const status = getAQIStatus(aqi);

  lines.push(pick([
    `ഇന്നത്തെ വായു ഗുണനിലവാര സൂചിക (AQI) ഏകദേശം ${aqi} ആണ് (${status.text} ${status.emoji})${dominant ? `, പ്രധാന ഘടകം ${dominant}` : ""}.`,
    `വായു ഗുണനിലവാരം നിലവിൽ AQI ${aqi} നിലയിലാണ് (${status.text} ${status.emoji})${dominant ? `, ${dominant} ആണ് പ്രധാന കാരണം` : ""}.`
  ]));

  if (pm25 != null) lines.push(pick([
    `PM2.5 അളവ് ഏകദേശം ${toFixedSafe(pm25,1)} µg/m³ ആണ്.`,
    `അന്തരീക്ഷത്തിലെ PM2.5 കണികകൾ ഏകദേശം ${toFixedSafe(pm25,1)} µg/m³ ആയി രേഖപ്പെടുത്തി.`
  ]));
  if (pm10 != null) lines.push(`PM10 അളവ് ഏകദേശം ${toFixedSafe(pm10,1)} µg/m³ ആണ്.`);

  if (pm25Trend1h != null && Math.abs(pm25Trend1h) >= 3) {
    if (pm25Trend1h > 0) lines.push(pick([
      "കഴിഞ്ഞ ഒരു മണിക്കൂറിനുള്ളിൽ പൊടിപടലങ്ങളുടെ അളവ് ഉയരുന്ന പ്രവണത കാണിക്കുന്നു.",
      "അന്തരീക്ഷ മലിനീകരണം കഴിഞ്ഞ മണിക്കൂറിൽ അല്പം വർധിച്ചതായി ഡാറ്റ സൂചിപ്പിക്കുന്നു."
    ]));
    else lines.push(pick([
      "കഴിഞ്ഞ ഒരു മണിക്കൂറിനുള്ളിൽ വായു ഗുണനിലവാരം മെച്ചപ്പെടുന്ന പ്രവണതയാണ് കാണുന്നത്.",
      "പൊടിപടലങ്ങളുടെ അളവ് കഴിഞ്ഞ മണിക്കൂറിൽ അല്പം കുറഞ്ഞതായി കാണുന്നു."
    ]));
  }

  if (co2 != null && co2 > 800) {
    lines.push(`അന്തരീക്ഷത്തിലെ CO₂ അളവ് ഏകദേശം ${Math.round(co2)} ppm ആയി അല്പം ഉയർന്ന നിലയിൽ രേഖപ്പെടുത്തി.`);
  }

  if (aqi <= 50) {
    lines.push(pick([
      "വായു ഗുണനിലവാരം ഇപ്പോൾ വളരെ നല്ല നിലയിലാണ്; എല്ലാവർക്കും പുറംപ്രവർത്തനങ്ങൾ സുരക്ഷിതമായി തുടരാം.",
      "നിലവിലെ അന്തരീക്ഷ വായു ശുദ്ധമായ നിലയിലായതിനാൽ പ്രത്യേക മുൻകരുതലുകൾ ആവശ്യമില്ല."
    ]));
  } else if (aqi <= 100) {
    lines.push(pick([
      "വായു ഗുണനിലവാരം സാധാരണ പരിധിക്കുള്ളിലാണ്; മിക്കവർക്കും ഇത് പ്രശ്നമാകില്ല.",
      "നിലവിലെ നിലവാരം സാമാന്യം സ്വീകാര്യമാണ്, സെൻസിറ്റീവ് വിഭാഗങ്ങൾ മാത്രം ചെറിയ ശ്രദ്ധ പുലർത്തിയാൽ മതി."
    ]));
  } else if (aqi <= 200) {
    lines.push(pick([
      "ദീർഘനേരം തുറന്ന പ്രദേശങ്ങളിൽ ചെലവഴിക്കുന്നത് അല്പം കുറയ്ക്കുന്നത് നല്ലതാണ്, പ്രത്യേകിച്ച് ശ്വാസകോശ സംബന്ധമായ പ്രശ്നങ്ങളുള്ളവർക്ക്.",
      "ആസ്ത്മ പോലുള്ള ശ്വാസകോശ പ്രശ്നങ്ങളുള്ളവർ ഇന്ന് പുറത്തെ ദീർഘനേരത്തെ പ്രവർത്തനങ്ങൾ ക്രമീകരിക്കുന്നത് നന്നായിരിക്കും."
    ]));
  } else if (aqi <= 300) {
    lines.push("വായു ഗുണനിലവാരം മോശമായതിനാൽ പുറംപ്രവർത്തനങ്ങൾ പരിമിതപ്പെടുത്തുന്നതാണ് നല്ലത്, പ്രത്യേകിച്ച് കുട്ടികളും പ്രായമായവരും.");
  } else {
    lines.push("വായു ഗുണനിലവാരം അതിമോശം നിലയിലായതിനാൽ അത്യാവശ്യമല്ലാത്ത പുറംപ്രവർത്തനങ്ങൾ ഒഴിവാക്കുന്നതാണ് ഉചിതം.");
  }

  return lines;
}

function styleWrap(text) {
  if (!text) return null;
  if (REPORT_STYLE === "radio") {
    return text
      .replace("സാധ്യതയുണ്ട്.", "എന്ന സൂചനയുണ്ട്.")
      .replace("ആവശ്യമാണ്.", "ശ്രദ്ധിക്കണം.");
  }
  return text; // mathrubhumi = unchanged, formal
}

// ---------------- Essay generator ----------------
function generateLongNewsMalayalam({ core, rainForecast, imdAlert, dataConfidenceNote, now }) {
  const s = [];
  const hour = core?.hourIST ?? now.getHours();
  const daytime = core?.daytime ?? (hour >= 6 && hour <= 18);

  const temp = core?.temp ?? null;
  const humidity = core?.humidity ?? null;
  const feelsLike = core?.feelsLike ?? null;
  const dewPoint = core?.dewPoint ?? null;
  const windSpeedKmh = core?.windSpeedKmh ?? null;
  const windGustKmh = core?.windGustKmh ?? null;
  const windDirML = core?.windDirML ?? null;
  const solar = core?.solar ?? null;
  const uvi = core?.uvi ?? null;
  const pressureRel = core?.pressureRel ?? null;
  const rainRateNow = core?.rainRateNow ?? null;
  const hourlyRain = core?.hourlyRain ?? null;
  const dailyRain = core?.dailyRain ?? null;
  const pm25 = core?.pm25 ?? null;
  const pm10 = core?.pm10 ?? null;
  const co2 = core?.co2 ?? null;
  const aqi = core?.aqi ?? null;
  const dominant = core?.dominant ?? null;
  const tempTrend1h = core?.tempTrend1h ?? null;
  const tempAnomaly24h = core?.tempAnomaly24h ?? null;
  const pressureTrend3h = core?.pressureTrend3h ?? null;
  const pm25Trend1h = core?.pm25Trend1h ?? null;
  const maxTempRec = core?.maxTempRec ?? null;
  const minTempRec = core?.minTempRec ?? null;
  const maxGustRec = core?.maxGustRec ?? null;

  const rainProbNow = rainForecast?.rainProbNow ?? 0;
  const rainProbNext3h = rainForecast?.rainProbNext3h ?? 0;

  const rainSignal = Math.max(
    rainProbNow,
    (rainRateNow != null && rainRateNow > 0) ? 90 : 0,
    (hourlyRain != null) ? Math.min(100, hourlyRain * 15) : 0
  );
  const coreSeason = core?.season ?? fallbackSeasonFromMonth(now.getMonth() + 1);
  const seasonBucket = mapCoreSeasonToNarrativeBucket(coreSeason, humidity, rainSignal);

  // Single warmth gate used by every "this will feel uncomfortable" line below —
  // humidity or calm wind alone don't make a claim like that true; it needs to
  // actually feel warm first.
  const effectiveTemp = feelsLike ?? temp;
  const warm = effectiveTemp != null && effectiveTemp >= 28;

  /* SYNTHESIZED TOP ALERT */
  const topAlert = computeTopAlert({ temp, humidity, aqi, pressureTrend3h, rainRateNow, rainProbNow });
  if (topAlert) s.push(`🔔 ഇന്നത്തെ പ്രധാന സൂചന: ${topAlert}`);

  /* SEASON CONTEXT */
  if (seasonBucket === "ഇടവപ്പാതി") {
    s.push(pick([
      "ഇടവപ്പാതി കാലഘട്ടത്തിന്റെ സ്വഭാവം പ്രകടമായതിനാൽ ചൂടും ഈർപ്പവും ചേർന്ന അസ്വസ്ഥതയാണ് പ്രധാനമായി അനുഭവപ്പെടുന്നത്.",
      "വേനൽ ശക്തിപ്പെടുന്ന ഈ കാലയളവിൽ ചൂടും ഈർപ്പവും ചേർന്ന് അസ്വസ്ഥത കൂടുതലായി അനുഭവപ്പെടാം."
    ]));
  } else if (seasonBucket === "കാലവർഷം") {
    s.push(pick([
      "കാലവർഷത്തിന്റെ സ്വാധീനത്തിൽ അന്തരീക്ഷം പെട്ടെന്ന് മാറാവുന്ന അവസ്ഥയിലാണ്.",
      "മൺസൂൺ സജീവമായതിനാൽ കാലാവസ്ഥയിൽ പെട്ടെന്നുള്ള മാറ്റങ്ങൾക്ക് സാധ്യതയുണ്ട്."
    ]));
  }

  /* TIME OF DAY */
  if (hour < 9) {
    s.push(pick([
      "രാവിലെ മണിക്കൂറുകളിൽ എലങ്കുളത്ത് അന്തരീക്ഷം പൊതുവെ ശാന്തമായ നിലയിലാണ്. രാത്രിയിൽ സഞ്ചയിച്ച ചെറിയ കുളിർമ ഇപ്പോഴും ചില പ്രദേശങ്ങളിൽ അനുഭവപ്പെടുന്നുണ്ടെങ്കിലും, സൂര്യൻ ഉയരുന്നതോടെ ഈ തണുപ്പിന്റെ സ്വാധീനം പതുക്കെ കുറയാൻ തുടങ്ങും.",
      "രാവിലത്തെ സമയമായതിനാൽ എലങ്കുളത്ത് അന്തരീക്ഷം താരതമ്യേന ശാന്തമായി തുടരുന്നു. പകൽ മുന്നോട്ട് പോകുന്തോറും ചൂട് ക്രമേണ കൂടിവരും."
    ]));
  } else if (hour < 15) {
    s.push(pick([
      "പകൽ സമയം പുരോഗമിക്കുമ്പോൾ സൂര്യന്റെ നേരിട്ടുള്ള സ്വാധീനത്തിൽ ചൂട് ശക്തമാകുന്ന സ്ഥിതിയാണ് കാണുന്നത്. തുറന്ന പ്രദേശങ്ങളിലും കോൺക്രീറ്റ് മേൽക്കൂരകളുള്ള ഇടങ്ങളിലുമുള്ളവർക്ക് വിയർപ്പും ക്ഷീണവും അനുഭവപ്പെടാൻ സാധ്യത കൂടുതലാണ്.",
      "ഉച്ചയോടടുത്ത സമയമായതിനാൽ സൂര്യതാപം ശക്തമായി അനുഭവപ്പെടുന്നു. തുറസ്സായ സ്ഥലങ്ങളിൽ ജോലി ചെയ്യുന്നവർ ഇടയ്ക്കിടെ വിശ്രമിക്കുന്നത് നല്ലതാണ്."
    ]));
  } else if (warm) {
    s.push(pick([
      "സന്ധ്യയോടെ സൂര്യന്റെ ശക്തി കുറയാൻ തുടങ്ങുന്നുണ്ടെങ്കിലും, അന്തരീക്ഷത്തിലെ ഈർപ്പം നിലനിൽക്കുന്നതിനാൽ പൂർണ്ണമായ ആശ്വാസം ഉടൻ ലഭിക്കുന്നില്ല. ഇത് വൈകുന്നേര സമയത്തെ അസ്വസ്ഥതയ്ക്ക് കാരണമാകാം.",
      "വൈകുന്നേരമായതോടെ ചൂടിന് ചെറിയ കുറവ് അനുഭവപ്പെടുന്നുണ്ടെങ്കിലും ഈർപ്പം ഇപ്പോഴും നിലനിൽക്കുന്നു."
    ]));
  } else {
    s.push(pick([
      "സന്ധ്യയോടെ അന്തരീക്ഷം സുഖകരമായ നിലയിലേക്ക് മാറുന്നു; വലിയ അസ്വസ്ഥത പ്രതീക്ഷിക്കേണ്ടതില്ല.",
      "വൈകുന്നേരമായതോടെ താപനില മിതമായതിനാൽ അന്തരീക്ഷം ഏറെക്കുറെ സുഖകരമാണ്."
    ]));
  }

  /* TEMPERATURE BLOCK */
  buildTempNarrative(temp, humidity, feelsLike, dewPoint).forEach(l => s.push(l));

  /* TREND / ANOMALY (real station trend + real 24h-ago comparison) */
  const trendText = getTempTrendNarrative(tempTrend1h, tempAnomaly24h);
  if (trendText) s.push(trendText);

  /* HEAT / HUMIDITY / WIND IMPACT */
  const heatText = getHeatImpact({ temp, hour, humidity, windKmh: windSpeedKmh, tempTrend: tempTrend1h });
  if (heatText) s.push(styleWrap(heatText));

  const humidityText = getHumidityImpact(humidity, hour, warm);
  if (humidityText) s.push(styleWrap(humidityText));

  const windImpactText = getWindImpact(windSpeedKmh, warm);
  if (windImpactText) s.push(styleWrap(windImpactText));

  /* WIND DETAIL */
  const windText = buildWindNarrative(windSpeedKmh, windGustKmh, windDirML);
  if (windText) s.push(windText);

  /* PRESSURE */
  const pressureText = buildPressureNarrative(pressureRel, pressureTrend3h);
  if (pressureText) s.push(pressureText);

  /* SOLAR / UV */
  const solarText = buildSolarNarrative(solar, uvi, daytime);
  if (solarText) s.push(solarText);

  /* RAIN — real rain rate ground-truth, forecast probability as outlook */
  s.push(getRainNarrative(rainRateNow, hourlyRain, dailyRain, rainProbNow, rainProbNext3h));

  /* 24H CONTEXT — new, uses real station history */
  const extremesText = buildDailyExtremesNarrative(maxTempRec, minTempRec, maxGustRec);
  if (extremesText) s.push(extremesText);

  /* AIR QUALITY — fixed grading, no blanket respiratory-caution line */
  buildAqiNarrative(pm25, pm10, co2, aqi, dominant, pm25Trend1h).forEach(l => s.push(l));

  /* PUBLIC ADVICE */
  s.push(pick([
    "💡 **പൊതുജന നിർദ്ദേശം:**\nഉച്ച സമയങ്ങളിൽ നേരിട്ട് സൂര്യപ്രകാശം ഏറ്റുവാങ്ങുന്ന പ്രവർത്തനങ്ങൾ പരിമിതപ്പെടുത്തുക. ധാരാളം വെള്ളം കുടിക്കുക. കുട്ടികളും വയോധികരും അധിക ചൂട് അനുഭവപ്പെടുന്ന സാഹചര്യങ്ങളിൽ വിശ്രമം ഉറപ്പാക്കുന്നത് ആരോഗ്യപരമായി ഗുണകരമായിരിക്കും.",
    "💡 **പൊതുജന നിർദ്ദേശം:**\nദിവസം മുഴുവൻ ആവശ്യത്തിന് വെള്ളം കുടിക്കുക. നേരിട്ട് വെയിലേൽക്കുന്ന ജോലികൾ ഇടവേളകളോടെ ചെയ്യുക. കുട്ടികൾ, വയോധികർ, ഗർഭിണികൾ എന്നിവർ പ്രത്യേകം ശ്രദ്ധിക്കുക."
  ]));

  /* IMD ALERT (unchanged) */
  if (imdAlert) {
    if (imdAlert.status === "available" && imdAlert.text) {
      s.push(
        `⚠️ **ഔദ്യോഗിക മുന്നറിയിപ്പ് (IMD):**\nകേന്ദ്ര കാലാവസ്ഥാ വകുപ്പിന്റെ അറിയിപ്പ് പ്രകാരം പ്രദേശത്ത് ` +
        `${imdAlertMalayalamMeaning(imdAlert.text.match(/[oyrg]$/i)?.[0] || "g")} നിലവിലാണ്.\n` +
        `അവസാനം പുതുക്കിയത്: ${imdAlert.lastUpdated}`
      );
    } else if (imdAlert.status === "no-today-data") {
      s.push(
        "ℹ️ **IMD അറിയിപ്പ്:**\nഇന്നത്തെ ദിവസത്തേക്കുള്ള പ്രത്യേക മുന്നറിയിപ്പ് നിലവിൽ ഇല്ല. സ്ഥിതി സാധാരണ നിലയിലായിരിക്കാനാണ് സാധ്യത."
      );
    }
  }

  /* DATA CONFIDENCE */
  if (dataConfidenceNote) s.push(dataConfidenceNote);

  s.push("--------------------------------------------------");
  s.push(pick([
    "കുറിപ്പ്: ഈ റിപ്പോർട്ട് ELWOIC-ന്റെ സ്വന്തം കാലാവസ്ഥാ സ്റ്റേഷനിൽ നിന്നും മറ്റ് ഔദ്യോഗിക ഡാറ്റ സ്രോതസ്സുകളിൽ നിന്നുമുള്ള വിവരങ്ങൾ അടിസ്ഥാനമാക്കി ഓട്ടോമേറ്റഡ് രീതിയിൽ തയ്യാറാക്കിയതാണ്. പ്രാദേശിക സാഹചര്യങ്ങൾ അനുസരിച്ച് കാലാവസ്ഥയിൽ പെട്ടെന്ന് മാറ്റങ്ങൾ സംഭവിക്കാവുന്നതാണ്.",
    "കുറിപ്പ്: ഈ വിവരങ്ങൾ ELWOIC സ്റ്റേഷൻ ഡാറ്റയും പ്രവചന ഡാറ്റയും കൂട്ടിച്ചേർത്ത് സ്വയമേവ തയ്യാറാക്കുന്നതാണ്. കൃത്യമായ തീരുമാനങ്ങൾക്ക് ഔദ്യോഗിക മുന്നറിയിപ്പുകൾ കൂടി പരിഗണിക്കുക."
  ]));

  return s.join("\n\n");
}

// ---------------- Initialize ----------------
(async function init(){
  try{ await runOnceAndRender(); }catch(e){console.warn("render error",e);}
  setInterval(()=>{ try{ runOnceAndRender();}catch(e){console.warn(e);} }, AUTO_REFRESH_MS);
})();
