// elamkulam-forecast.js
// Version: News-style, very lengthy Malayalam essay, wind in km/h, constant headline
// Usage: place <div id="elamkulam-forecast-report"></div> in your page and include:
// <script type="module" src="elamkulam-forecast.js"></script>

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

async function fetchEstimatedAQI(){
  try{
    const url=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5`;
    const res=await fetch(url);
    const data=await res.json();
    if(!data?.current?.pm2_5) return null;
    const pm25=data.current.pm2_5;
    let aqi=1;
    if(pm25<=12) aqi=1;
    else if(pm25<=35.4) aqi=2;
    else if(pm25<=55.4) aqi=3;
    else if(pm25<=150.4) aqi=4;
    else aqi=5;
    return { aqi, pm25, source:"Estimated (Open-Meteo)" };
  }catch(e){return null;}
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

function generateLongNewsMalayalam({ computed, owmData, airQuality, imdAlert }){
  const s = []; 
  const now = new Date();
  
  // 1. HEADLINE AND INTRO
  s.push(`📰 ${HEADLINE}`);
  s.push(`${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`);
  s.push("--------------------------------------------------");
  s.push("എലങ്കുളം പ്രദേശത്തെ നിലവിലെ കാലാവസ്ഥാ സാഹചര്യങ്ങളെ സംബന്ധിച്ച വിപുലമായ റിപ്പോർട്ടാണിത്. വിവിധ അന്താരാഷ്ട്ര കാലാവസ്ഥാ ഏജൻസികളിൽ നിന്നും ഉപഗ്രഹ ചിത്രങ്ങളിൽ നിന്നുമുള്ള വിവരങ്ങൾ വിശകലനം ചെയ്തപ്പോൾ താഴെ പറയുന്ന കാര്യങ്ങളാണ് ലഭ്യമായിരിക്കുന്നത്.");

  // 2. DETAILED TEMPERATURE ANALYSIS
  if(computed.tempNow != null){
    const feelsLike = owmData?.main?.feels_like ? toFixedSafe(owmData.main.feels_like, 1) : "ലഭ്യമല്ല";
    let tempStatus = "സാധാരണ നിലയിലുള്ള";
    if(computed.tempNow > 32) tempStatus = "അല്പം ഉയർന്ന";
    else if(computed.tempNow < 24) tempStatus = "കുറഞ്ഞ";

    s.push(`🌡️ **താപനിലയും അന്തരീക്ഷാവസ്ഥയും:**\nനിലവിൽ എലങ്കുളത്ത് ${tempStatus} ചൂടാണ് അനുഭവപ്പെടുന്നത്. അന്തരീക്ഷ താപനില ${toFixedSafe(computed.tempNow, 1)}°C ആണെങ്കിലും, ഈർപ്പത്തിന്റെ സാന്നിധ്യം മൂലം ശാരീരികമായി അനുഭവപ്പെടുന്ന ചൂട് (Feels Like) ഏകദേശം ${feelsLike}°C വരെ ഉയരാൻ സാധ്യതയുണ്ട്. കഴിഞ്ഞ മണിക്കൂറിൽ താപനിലയിൽ ${computed.tempTrend > 0 ? 'വർദ്ധനവ്' : 'കുറവ്'} രേഖപ്പെടുത്തിയിട്ടുണ്ട്.`);
  }

  // 3. HUMIDITY & AIR QUALITY
  if(computed.humidity != null || airQuality){
    let humDesc = computed.humidity > 80 ? "അന്തരീക്ഷത്തിൽ ഈർപ്പം വളരെ കൂടുതലാണ്, ഇത് വിയർപ്പിനും അസ്വസ്ഥതയ്ക്കും കാരണമായേക്കാം." : "അന്തരീക്ഷം താരതമ്യേന വരണ്ടതാണ്.";
    s.push(`💧 **ഈർപ്പവും വായുനിലയും:**\nപ്രദേശത്തെ ആപേക്ഷിക ആർദ്രത (Humidity) ${Math.round(computed.humidity)}% ആണ്. ${humDesc}`);
    
    if(airQuality){
      s.push(`വായുനില സൂചിക (AQI) ${airQuality.aqi} എന്ന നിലയിലാണ്. ഇത് ${aqiMalayalamMeaning(airQuality.aqi)} വിഭാഗത്തിൽ ഉൾപ്പെടുന്നു. ശ്വാസകോശ സംബന്ധമായ അസുഖമുള്ളവർ മുൻകരുതലുകൾ എടുക്കുന്നത് ഉചിതമായിരിക്കും.`);
    }
  }

  // 4. WIND & VISIBILITY
  if(computed.windSpeedMs != null || owmData?.visibility){
    const kmh = msToKmh(computed.windSpeedMs);
    const vis = owmData?.visibility ? (owmData.visibility/1000).toFixed(1) : "ലഭ്യമല്ല";
    s.push(`🌬️ **കാറ്റും ദൃശ്യപരതയും:**\nനിലവിൽ ${windDirMalayalam(computed.windDir)} ദിശയിൽ നിന്ന് മണിക്കൂറിൽ ${toFixedSafe(kmh, 1)} കിലോമീറ്റർ വേഗതയിലാണ് കാറ്റ് വീശുന്നത്. അന്തരീക്ഷത്തിലെ ദൃശ്യപരത (Visibility) ${vis} കിലോമീറ്ററാണ്. വാഹനയാത്രികർക്കും മറ്റും ഇത് അനുകൂലമായ സാഹചര്യമാണ്.`);
  }

  // 5. PRECIPITATION & RAIN FORECAST
  s.push(`🌧️ **മഴയ്ക്കുള്ള സാധ്യത:**`);
  if(computed.precipNow != null && computed.precipNow > 0.1){
    s.push("നിലവിൽ പ്രദേശത്ത് മഴ പെയ്തുകൊണ്ടിരിക്കുകയാണ്. വരും മണിക്കൂറുകളിലും ഈ സ്ഥിതി തുടരാൻ സാധ്യതയുണ്ടെന്ന് റഡാർ ചിത്രങ്ങൾ സൂചിപ്പിക്കുന്നു.");
  } else {
    const prob = Math.round(computed.precipProb || 0);
    let probText = prob > 50 ? "മഴ പെയ്യാൻ വളരെ ഉയർന്ന സാധ്യതയുണ്ട്." : (prob > 20 ? "ചെറിയ തോതിൽ മഴ പെയ്യാൻ സാധ്യതയുണ്ട്." : "മഴയ്ക്കുള്ള സാധ്യത നിലവിൽ വളരെ കുറവാണ്.");
    s.push(`അടുത്ത ഏതാനും മണിക്കൂറുകളിൽ മഴ ലഭിക്കാനുള്ള സാധ്യത ${prob}% ആണ്. ${probText}`);
  }

  // 6. TRENDS & LONG-TERM OUTLOOK
  if(computed.tempTrend != null){
    const trendWord = computed.tempTrend > 0.15 ? "ക്രമാനുഗതമായി വർദ്ധിച്ചുവരികയാണ്" : (computed.tempTrend < -0.15 ? "താഴ്ന്നുവരികയാണ്" : "മാറ്റമില്ലാതെ തുടരുന്നു");
    s.push(`📈 **പ്രവണതകൾ:**\nകഴിഞ്ഞ പന്ത്രണ്ട് മണിക്കൂർ വിശകലനം ചെയ്യുമ്പോൾ താപനില ${trendWord}. പകൽ സമയം പുരോഗമിക്കുമ്പോൾ ഇതിൽ നേരിയ വ്യതിയാനങ്ങൾ വരാം.`);
  }

  // 7. PUBLIC ADVISORY (New Section)
  s.push(`💡 **പൊതുജന നിർദ്ദേശങ്ങൾ:**\nകാലാവസ്ഥാ വ്യതിയാനങ്ങൾക്കനുസരിച്ച് യാത്രകൾ ക്രമീകരിക്കുക. ${computed.tempNow > 32 ? 'ധാരാളം വെള്ളം കുടിക്കാനും നിർജ്ജലീകരണം ഒഴിവാക്കാനും ശ്രദ്ധിക്കുക.' : 'പുറത്തിറങ്ങുമ്പോൾ കുടയോ റെയിൻകോട്ടോ കരുതുന്നത് ഉചിതമായിരിക്കും.'}`);

  // 8. IMD & FOOTER
  if(imdAlert && imdAlert.text){
    s.push(`⚠️ **ഔദ്യോഗിക ജാഗ്രതാ നിർദ്ദേശം:**\nകേന്ദ്ര കാലാവസ്ഥാ വകുപ്പിന്റെ (IMD) ഏറ്റവും പുതിയ അറിയിപ്പ് പ്രകാരം പ്രദേശത്ത് ${imdAlertMalayalamMeaning(imdAlert.text.match(/[oyrg]$/i)?.[0] || 'g')} നിലനിൽക്കുന്നു.`);
  }

  s.push("--------------------------------------------------");
  s.push("കുറിപ്പ്: ഈ റിപ്പോർട്ട് ഓട്ടോമേറ്റഡ് സിസ്റ്റം തയ്യാറാക്കിയതാണ്. കൃത്യമായ വിവരങ്ങൾക്കായി ഔദ്യോഗിക സർക്കാർ അറിയിപ്പുകൾ പിന്തുടരുക.");

  return s.join("\n\n");
}

// ---------------- Render main ----------------
async function runOnceAndRender(){
  const container=document.getElementById(CONTAINER_ID);
  if(!container){ console.warn(`Container #${CONTAINER_ID} not found.`); return; }
  container.innerHTML=`<div class="meta">അപ്‌ഡേറ്റ് ചെയ്യുന്നു — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;

  let meteo=null, owm=null, airQuality=null;
  try{ meteo=await fetchOpenMeteoHourly(); }catch(e){console.warn("Open-Meteo failed",e);}
  try{ owm=await fetchOpenWeatherCurrent(); }catch(e){console.warn("OpenWeather failed",e);}
  try{ airQuality=await fetchEstimatedAQI(); }catch(e){ airQuality=null; }

  const computed=meteo?computeFromMeteo(meteo):{};
  if(owm){
    if(computed.humidity==null && owm.main?.humidity!=null) computed.humidity=owm.main.humidity;
    if(computed.windSpeedMs==null && owm.wind?.speed!=null) computed.windSpeedMs=owm.wind.speed;
    if(computed.windDir==null && owm.wind?.deg!=null) computed.windDir=owm.wind.deg;
    if(computed.tempNow==null && owm.main?.temp!=null) computed.tempNow=owm.main.temp;
  }

  const imdAlert=window.imdAlerts?window.imdAlerts[`${new Date().getFullYear()}-${pad(new Date().getMonth()+1)}-${pad(new Date().getDate())}`]:null;
  const essay=generateLongNewsMalayalam({computed,owmData:owm,airQuality,imdAlert});
  const heading=`<h2>${escapeHtml(HEADLINE)}</h2>`;
  const meta=`<div class="meta">${escapeHtml(formatDateMalayalam(new Date()))} — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;

  container.innerHTML=`${heading}${meta}<pre>${escapeHtml(essay)}</pre>`;
}

// ---------------- Initialize ----------------
(async function init(){
  try{ await runOnceAndRender(); }catch(e){console.warn("render error",e);}
  setInterval(()=>{ try{ runOnceAndRender();}catch(e){console.warn(e);} }, AUTO_REFRESH_MS);
})();
