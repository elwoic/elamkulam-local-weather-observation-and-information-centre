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
function generateLongNewsMalayalam({ computed, imdAlert, airQuality }){
  // We'll build many sentences across several paragraphs to reach 20-30 sentences.
  // Use professional neutral news phrasing, no advice.
  const s = [];
  const now = new Date();
  const dateLine = `${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;

  s.push(HEADLINE);
  s.push(dateLine);
  s.push(""); // blank

  // Paragraph 1: overall situation (3-4 sentences)
  s.push("പ്രാദേശീയ അന്തരീക്ഷ സാഹചര്യത്തിന്റെ ആധുനിക നിരീക്ഷണങ്ങളെ അടിസ്ഥാനമാക്കി ഏലങ്കുളം പ്രദേശത്ത് നിന്നുള്ള ഉപയോഗപ്രദമായ വ്യക്തമായ അവലോകനം താഴെ കൊടുക്കുന്നു.");
  if (computed.tempNow != null) {
    s.push(`ഇപ്പോൾ രേഖപ്പെടുത്തപ്പെട്ട താപനില ${toFixedSafe(computed.tempNow,1)}°C ആണ്; ഇത് കഴിഞ്ഞ കുറച്ചുമണിക്കൂറുകളിലെ ശരാശരിയുടെ അടിസ്ഥാനത്തിൽ വിലയിരുത്തുമ്പോൾ സമാന നിരപ്പിൽ നിന്ന് ${computed.tempTrend>0.15 ? 'ഉയർന്ന' : (computed.tempTrend < -0.15 ? 'താഴ്ന്ന' : 'സ്ഥിരമായ')} നിലപാടിലാണ് കാണപ്പെടുന്നത്.`);
  } else {
    s.push("താപനിലയുടെ ഇപ്പോഴത്തെ ആധികാരികമായ മാനം ലഭ്യമല്ല; ഇതു സംബന്ധിച്ച നിലവിലുള്ള രേഖകൾ ഇല്ലാത്തതിനാൽ മറ്റ് ഉപയോഗപ്രദമായ പരാമർശങ്ങൾ താഴെ കൊടുക്കുന്നു.");
  }
  s.push("ഇന്ന് പ്രദേശത്ത് ആകെ മേഘവൃതമായി  നിലനിൽക്കുന്നുവെന്ന് നിരീക്ഷണങ്ങൾ സൂചിപ്പിക്കുന്നു; മേഘ സാന്നിധ്യം പല ഭാഗങ്ങളിലും പരിമിതമായി കാണപ്പെടുന്നു.");

  // Paragraph 2: humidity and feel (2-3 sentences)
  if (computed.humidity != null) {
    s.push(` അന്തരീക്ഷത്തിലെ ആർദ്രത(ഹ്യൂമിഡിറ്റി) നിലവിൽ ശ്രദ്ധിച്ചാൽ, നിലവിൽ  ${Math.round(computed.humidity)}% ആണ്; ഈ നിലയിൽ വരുന്ന ചെറിയ വ്യതിയാനങ്ങൾ പ്രദേശത്തിന്റെ വായു തണുത്തതോ ചൂടേറിയതയോ ആയി തോന്നിച്ചേക്കാം.`);
  } else {
    s.push("ഹ്യൂമിഡിറ്റി വിശകലനത്തിന് നിലവിൽ വിശ്വസ്തമായ ഡാറ്റ ലഭ്യമല്ല.");
  }
  s.push("മൊത്തത്തിൽ, അന്തരീക്ഷത്തിലെ ഈർപ്പംമാറ്റങ്ങൾ പ്രദേശത്തെ അർദ്രതയെ കാര്യമായി ബാധിച്ചേക്കാം.");

  // Paragraph 3: wind detail (3 sentences)
  if (computed.windSpeedMs != null) {
    const kmh = msToKmh(computed.windSpeedMs);
    s.push(`കാറ്റിന്റെ ഇപ്പോഴത്തെ രേഖപ്പെടുത്തിയ വേഗത  ഏകദേശം ${toFixedSafe(kmh,1)} km/h ആയി അളക്കപ്പെടുന്നു; ദിശ ${windDirMalayalam(computed.windDir)} (${computed.windDir != null ? Math.round(computed.windDir) + "°" : 'ലഭ്യമല്ല'}) ആണ്.`);
    s.push("ഈ വേഗതയിൽ കാറ്റ് വീശുന്നതിനാൽ ശക്തമായ മഴക്കോ കടലിന്റെ നിലയിൽ വലിയ മാറ്റങ്ങളോ ഉണ്ടാകാനുള്ള സാധ്യത കുറഞ്ഞതാണ് എന്ന് വിലയിരുത്തുന്നു.");
    s.push("കാറ്റിന്റെ ദിശയും വേഗവും അടുത്ത മണിക്കൂറുകളിൽ ചെറിയ മാറ്റങ്ങൾ കാണിച്ചേക്കാം; അതേസമയം വലിയ രീതിയില്‍ ദിശമാറ്റം പ്രതീക്ഷിക്കപ്പെടുന്നില്ലെന്നതാണ് ഇപ്പോഴത്തെ നിരീക്ഷണത്തിന്റെ ഫലം ചൂണ്ടിക്കാണിക്കുന്നു.");
  } else {
    s.push("കാറ്റ് സംബന്ധിയായ സമഗ്രവും വിശ്വസ്തവുമായ വിവരങ്ങൾ ലഭ്യമല്ല.");
  }

  // Paragraph 4: rain & cloud (3-5 sentences)
  if (computed.precipNow != null && computed.precipNow > 0.1) {
    s.push(`പ്രദേശത്ത് നിലവിൽ ഈ അളവിൽ പെയ്യുന്ന മഴയാണ് രേഖപ്പെടുത്തിയിരിക്കുന്നത്; കഴിഞ്ഞ മണിക്കൂറിനിടയിൽ പുറത്തുവന്ന രേഖകൾ പ്രകാരം ഈ മഴ ലഘുവായി തുടരുന്നതിനുള്ള സാധ്യത കാണപ്പെടുന്നു.`);
  } else if (computed.precipProb != null) {
    s.push(`അടുത്ത മണിക്കൂറുകളില്‍ മോഡൽ അടിസ്ഥാനത്തിലുള്ള ശരാശരി മഴസാദ്ധ്യത ${Math.round(computed.precipProb)}% വരെയാണ് കണക്കായിരിക്കുന്നത്; ഇത് ലഘു മുതൽ ഇടയ്ക്കിടെ ശക്തമായ  മഴ വരുത്താവുന്ന തോതിലാണ്.`);
  } else {
    s.push("പ്രദേശത്ത് നിലവിൽ ശക്തമായ മഴ എന്ന തരത്തിലുള്ള റിപ്പോർട്ടുകൾ ലഭ്യമല്ല; മേഘാവൃതമായി ചില ഭാഗങ്ങളിൽ തുടരാനിടയുണ്ട്.");
  }
  s.push("മേഘാവരണത്തിന്റെ മാറ്റങ്ങൾ ദേശിയ മോണിറ്ററിംഗ് ഡാറ്റാ ഫ്ലോകളിൽനിന്നും സാധാരണ രീതിയിൽ രേഖപ്പെടുകയാണ്.");

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
    s.push("താപനിലയുടെ സമഗ്ര പ്രവണതാ കണക്കുക്കൂട്ടലുകൾ സാധിക്കാത്ത സാഹചര്യത്തിലാണ്.");
  }

  // Paragraph 6: seasonal context (2-3 sentences)
  const month = new Date().getMonth() + 1;
  if ([6,7,8,9].includes(month)) {
    s.push("മൂസൂൺ കാലാവസ്ഥാ സൂചനകളുമായി ബന്ധപ്പെട്ട വേളയിൽ പ്രവേശിച്ചതുകൊണ്ട്, ഇടക്കിടെ ഉണ്ടാകുന്ന വെയിലും മഴയും എന്ന വ്യതിയാനങ്ങൾ പ്രതീക്ഷിക്കാവുന്നതാണ്.");
  } else if ([10,11,12,1].includes(month)) {
    s.push("ഇപ്പോൾ ശൈത്യകാല യാത്രയിലേക്കുള്ള കാലയളവിലാണ്; രാത്രികളിൽ താപനില കുറയുന്നതിനാൽ അല്പം തണുപ്പ് അനുഭവപ്പെടുന്നു. പുലർച്ചെ സമയങ്ങളിൽ ചെറുതായി മഞ്ഞ്/മൂടൽമഞ്ഞ് രൂപപ്പെടാൻ സാധ്യതയുണ്ട്. ");
  } else {
    s.push("ഈ സമയത്ത് പ്രദേശിക കാലാവസ്ഥ സാധാരണയായി മിശ്രമായ ഘടകങ്ങൾ പ്രദർശിപ്പിക്കുന്നു — ഉദയം മേഘാവൃതവും ഇടയ്ക്ക് മഴയും കാണപ്പെടാറുണ്ട്.");
  }

  // Paragraph 7: alerts and AQI (2-3 sentences)
  if (imdAlert && imdAlert.text) {
    s.push(`IMD (മലപ്പുറം) ഔദ്യോഗിക അറിയിപ്പ്: ${imdAlert.text} (അവസാന അപ്‌ഡേറ്റ്: ${imdAlert.lastUpdated || 'ലഭ്യമല്ല'}). ഈ അറിയിപ്പ് റിപ്പോർട്ടിൽ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.`);
  } else {
    s.push("IMD-നിന്നുള്ള ഔദ്യോഗിക അലേർട് ഈ തീയതിക്ക് ELWOIC രജിസ്റ്റർ ചെയ്തിട്ടില്ല.");
  }
  if (airQuality && (airQuality.aqi != null || airQuality.main != null)) {
    s.push(`വായുനില: AQI ${airQuality.aqi ?? 'ലഭ്യമല്ല'}; പ്രധാന ഘടകം: ${airQuality.main ?? 'ലഭ്യമല്ല'}.`);
  } else {
    s.push("പ്രാദേശിക വായുനില സംബന്ധിച്ച വിശ്വാസയോഗ്യമായ ഡാറ്റ ലഭ്യമല്ല.");
  }

  // Paragraph 8: local observations and user reports (2-4 sentences)
  s.push("പ്രാദേശിക നിരീക്ഷണങ്ങൾക്കും സമൂഹത്തില്‍നിന്നുള്ള റിപ്പോർട്ടുകൾക്കും പ്രധാനപ്പെട്ട സ്ഥാനം ഉണ്ട്. താഴെ ലഭ്യമായ റിപോർട്ടുകൾ ഉൾപ്പെടുത്തിയിട്ടുണ്ട്.");

  // Conclusion paragraph (1-2 sentences)
  s.push("സംഗ്രഹമായി, ഇന്നു ഇവിടെ രേഖപ്പെടുത്തിയ അന്തരീക്ഷ നിരീക്ഷണങ്ങളുടെ അടിസ്ഥാനത്തിൽ പ്രദേശികമായി ചില ഭാഗങ്ങളിൽ മേഘാവൃത്തം തുടരാനും സംബദ്ധമായ മഴ സാധ്യതകൾ നിലനിൽക്കും; അതോടൊപ്പം താപനിലയും കാറ്റിന്റെയും ചെറിയ വ്യതിയാനങ്ങൾ പ്രതീക്ഷിക്കാവുന്നതാണ്.");
  s.push("ഇത് റിപോർട്ട് മോണിറ്ററിംഗ് ഡാറ്റകളുടെ സംഹിതയാണ്; ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി IMD-യുടെ ഔദ്യോഗിക വിന്യാസങ്ങൾ പരിശോധിക്കുക.");

  // Join and ensure length
  const essay = s.join("\n\n");

  // Guarantee at least ~20 sentences: if shorter, add formal filler sentences to reach size
  const sentenceCount = essay.split(/[.!\?]\s/).filter(Boolean).length;
  if (sentenceCount < 20) {
    const fillers = [
      "വിപരിതമായ വിവരങ്ങൾ കൂടിച്ചേർക്കപ്പെടുന്ന  സാഹചര്യം ഉണ്ടായേക്കാവുന്നതിനാൽ പിഴവുകൾ നിർണ്ണയിക്കാനാവില്ല.",
      "കൃത്യമായ നിരീക്ഷണങ്ങൾക്കായി കൂടുതൽ ഡാറ്റ ആവശ്യമാണ്.",
      "പ്രാദേശിക നിരീക്ഷണ കേന്ദ്രങ്ങളിൽ നിന്ന് ലഭിക്കുന്ന സംയുക്ത വിവരങ്ങളെയും ഉൾപ്പെടുത്തി കാലാവസ്ഥാപശ്ചാത്തലത്തെ വിലയിരുത്തുന്ന നടപടിയിലാണ് നിലവിൽ നിരീക്ഷണ സംവിധാനങ്ങൾ.
"
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
      const loc = r.location || r.place || "ഏലംകുളം";
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
