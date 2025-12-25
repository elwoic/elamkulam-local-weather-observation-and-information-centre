// elamkulam-forecast-ai.js
// Version: Ultimate human+AI style Malayalam weather report
// Usage: <div id="elamkulam-forecast-report"></div>
// <script type="module" src="elamkulam-forecast-ai.js"></script>

// ---------------- CONFIG ----------------
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const LAT = 10.9081;
const LON = 76.2296;
const CONTAINER_ID = "elamkulam-forecast-report";
const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour
const HEADLINE = "എലങ്കുളം കാലാവസ്ഥാ സമഗ്ര റിപ്പോർട്ട്";

// Malayalam month names
const MONTHS_ML = ["ജനുവരി","ഫെബ്രുവരി","മാർച്ച്","ഏപ്രിൽ","മേയ്","ജൂൺ","ജൂലൈ","ഓഗസ്റ്റ്","സെപ്റ്റംബർ","ഒക്ടോബർ","നവംബർ","ഡിസംബർ"];

// ---------------- UTILS ----------------
function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){ return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`; }
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function escapeHtml(s){ return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'):""; }
function toFixedSafe(v,d=1){ return (v==null||isNaN(Number(v))) ? null : Number(v).toFixed(d); }
function msToKmh(ms){ return (ms==null||isNaN(ms)) ? null : ms*3.6; }
function windDirMalayalam(deg){
  if(deg==null||isNaN(deg)) return "ലഭ്യമല്ല";
  const dirs = ["ഉത്തര","ഉത്തര-കിഴക്ക്","കിഴക്ക്","തെക്ക്-കിഴക്ക്","തെക്ക്","തെക്ക്-പശ്ചിമ","പശ്ചിമ","വടക്ക്-പശ്ചിമ"];
  return dirs[Math.round(deg/45)%8];
}
function imdAlertMalayalamMeaning(code){
  const map={g:"Green (Safe) സുരക്ഷിതമായ അന്തരീക്ഷം",y:"Yellow (Watch) ജാഗ്രതാവഹിത അന്തരീക്ഷം",o:"Orange (Alert) ജാഗ്രത ആവശ്യമാണ്",r:"Red (Warning) അതീവ ജാഗ്രത ആവശ്യം"};
  return map[code.toLowerCase()]||"ലഭ്യമല്ല";
}
function aqiMalayalamMeaning(aqi){
  const map={1:"നല്ലത് (Good) — 0–50",2:"മിതമായത് (Fair) — 51–100",3:"മധ്യമം (Moderate) — 101–200",4:"മോശം (Poor) — 201–300",5:"അതിമോശം (Very Poor) — 301–500"};
  return map[aqi]||"ലഭ്യമല്ല";
}

// ---------------- FETCH DATA ----------------
async function fetchOpenMeteoHourly(lat=LAT, lon=LON){
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "Asia/Kolkata",
    hourly: "temperature_2m,relativehumidity_2m,precipitation,precipitation_probability,windspeed_10m,winddirection_10m,cloudcover",
    past_days: 1,
    forecast_days: 1
  });
  const r = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`);
  if(!r.ok) throw new Error("Open-Meteo fetch failed "+r.status);
  return r.json();
}

async function fetchOpenWeatherCurrent(lat=LAT, lon=LON){
  if(!OPENWEATHER_API_KEY) return null;
  const p=new URLSearchParams({lat,lon,appid:OPENWEATHER_API_KEY,units:"metric"});
  try{
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?${p.toString()}`);
    if(!r.ok) return null;
    return r.json();
  }catch(e){return null;}
}

async function fetchEstimatedAQI(){
  try{
    const url=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=pm2_5`;
    const res=await fetch(url); const data=await res.json();
    if(!data?.current?.pm2_5) return null;
    const pm25=data.current.pm2_5;
    let aqi=1;
    if(pm25<=12) aqi=1;
    else if(pm25<=35.4) aqi=2;
    else if(pm25<=55.4) aqi=3;
    else if(pm25<=150.4) aqi=4;
    else aqi=5;
    return {aqi,pm25,source:"Estimated (Open-Meteo)"};
  }catch(e){return null;}
}

function getImdAlertForToday(){
  try{
    const alerts=window.imdAlerts||{};
    const lastUpdated=window.imdLastUpdated||null;
    const now=new Date();
    const key=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    if(alerts[key]) return {text:alerts[key].text,lastUpdated};
    return null;
  }catch(e){return null;}
}

// ---------------- COMPUTE METRICS ----------------
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
    if(!times.length) return{};
    const last=times.length-1;
    const tempNow=temps[last]??null;
    const tempPrev=last-1>=0?temps[last-1]:null;
    const hours=12; const start=Math.max(0,last-hours+1);
    const slice=temps.slice(start,last+1).filter(v=>v!=null);
    let trend=null;if(slice.length>=2) trend=(slice[slice.length-1]-slice[0])/Math.max(1,slice.length-1);
    const precipNow=precip[last]??null;
    const precipProbNow=precipProb[last]??null;
    const windNow=windspeed[last]??null;
    const windDirNow=winddir[last]??null;
    const humNow=hum[last]??null;
    return {tempNow,tempPrevHour:tempPrev,tempTrend:trend,trendHours:slice.length,precipNow,precipProb:precipProbNow,windSpeedMs:windNow,windDir:windDirNow,humidity:humNow};
  }catch(e){return{};}
}

// ---------------- GENERATE ESSAY ----------------
function generateLongNewsMalayalam({computed,imdAlert,airQuality}){
  const s=[]; const now=new Date();
  const dateLine=`${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`;
  s.push(HEADLINE,dateLine,"");

  // Temp paragraph
  if(computed.tempNow!=null){
    s.push(`ഇപ്പോൾ പ്രദേശത്ത് താപനില ${toFixedSafe(computed.tempNow,1)}°C ആണ്. കഴിഞ്ഞ മണിക്കൂറുകളിലെ നിരീക്ഷണങ്ങൾ പ്രകാരം, ഇത് ${computed.tempTrend>0.15?'കൂടുന്നതാണ്':(computed.tempTrend<-0.15?'കുറയുന്നതാണ്':'സ്ഥിരമാണെന്ന്')} വ്യക്തമാക്കുന്നു.`);
  }else s.push("ഇപ്പോൾ താപനില സംബന്ധിച്ച കൃത്യമായ ഡാറ്റ ലഭ്യമല്ല.");

  // Humidity
  if(computed.humidity!=null) s.push(`വാതാവിലെ ഈർപ്പതത്വം ${Math.round(computed.humidity)}% ആണ്.`);
  else s.push("ഈർപ്പത്തിന്റെ നിലവിലുള്ള രേഖകൾ ലഭ്യമല്ല.");

  // Wind
  if(computed.windSpeedMs!=null){
    const kmh=msToKmh(computed.windSpeedMs);
    s.push(`കാറ്റ് ഏകദേശം ${toFixedSafe(kmh,1)} km/h വേഗത്തിൽ വീശുന്നു. ദിശ: ${windDirMalayalam(computed.windDir)}.`);
  }else s.push("കാറ്റിന്റെ വേഗതയും ദിശയും ലഭ്യമല്ല.");

  // Rain
  if(computed.precipNow!=null && computed.precipNow>0.1){
    s.push("പ്രദേശത്ത് ചെറിയ തോതിൽ മഴ പെയ്യുന്നു.");
  }else if(computed.precipProb!=null){
    s.push(`അടുത്ത മണിക്കൂറുകളിൽ മഴ സാധ്യത ${Math.round(computed.precipProb)}% ആണ്.`);
  }else s.push("മഴ ലഭ്യമല്ല.");

  // Temperature comparison
  if(computed.tempPrevHour!=null && computed.tempNow!=null){
    const diff=computed.tempNow-computed.tempPrevHour;
    const word=diff>0?"ഉയർന്നു":diff<0?"താഴ്ന്നു":"മാറ്റമില്ല";
    s.push(`കഴിഞ്ഞ ഒരു മണിക്കൂറിൽ താപനില ${Math.abs(diff).toFixed(1)}°C ${word}.`);
  }

  // Seasonal context
  const month=now.getMonth()+1;
  if([6,7,8,9].includes(month)) s.push("ദക്ഷിണ പടിഞ്ഞാറൻ മൺസൂൺ സജീവമാണ്; ഇടയ്ക്കിടെ മഴ ലഭിക്കാം.");
  else if([10,11,12,1].includes(month)) s.push("ശൈത്യകാല സാഹചര്യങ്ങൾ: രാവിലെ തണുപ്പ്, മൂടൽമഞ്ഞ് സാധാരണം.");
  else s.push("സൂര്യപ്രകാശം, മേഘാവരണം, ഇടവിട്ടുള്ള മഴ എന്നിവ മിശ്രിതം.");

  // Alerts
  if(imdAlert && imdAlert.text){
    const codeMatch=imdAlert.text.match(/[oyrg]$/i);
    const code=codeMatch?codeMatch[0]:null;
    const meaning=code?imdAlertMalayalamMeaning(code):"ലഭ്യമല്ല";
    s.push(`IMD മുന്നറിയിപ്പ്: ${meaning} (അവസാന അപ്ഡേറ്റ്: ${imdAlert.lastUpdated||'ലഭ്യമല്ല'})`);
  }else s.push("ഇന്നത്തെ IMD മുന്നറിയിപ്പ് ലഭ്യമല്ല.");

  // AQI
  if(airQuality && airQuality.aqi!=null){
    s.push(`വായുനില സൂചിക (AQI): ${airQuality.aqi} — ${aqiMalayalamMeaning(airQuality.aqi)}. (PM2.5: ${airQuality.pm25} µg/m³)`);}
  else s.push("പ്രാദേശിക വായുനില ഡാറ്റ ലഭ്യമല്ല.");

  // Conclusion
  s.push("ഈ റിപ്പോർട്ട് ലഭ്യമായ ഡാറ്റകളുടെ അടിസ്ഥാനത്തിലാണ്. ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി IMD അറിയിപ്പ് കാണുക.");

  return s.join("\n\n");
}

// ---------------- RENDER ----------------
async function runOnceAndRender(){
  const container=document.getElementById(CONTAINER_ID);
  if(!container) return;

  container.innerHTML=`<div class="meta">അപ്‌ഡേറ്റ് ചെയ്യുന്നു — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;

  let meteo=null, owm=null, airQuality=null;

  try{meteo=await fetchOpenMeteoHourly();}catch(e){console.warn("Open-Meteo failed",e);}
  try{owm=await fetchOpenWeatherCurrent();}catch(e){console.warn("OpenWeather failed",e);}
  try{airQuality=await fetchEstimatedAQI();}catch(e){airQuality=null;}

  const computed=meteo?computeFromMeteo(meteo):{};
  if(owm){
    if(computed.humidity==null && owm.main?.humidity!=null) computed.humidity=owm.main.humidity;
    if(computed.windSpeedMs==null && owm.wind?.speed!=null) computed.windSpeedMs=owm.wind.speed;
    if(computed.windDir==null && owm.wind?.deg!=null) computed.windDir=owm.wind.deg;
    if(computed.tempNow==null && owm.main?.temp!=null) computed.tempNow=owm.main.temp;
  }

  const imdAlert=getImdAlertForToday();
  const essay=generateLongNewsMalayalam({computed,imdAlert,airQuality});

  const heading=`<h2>${escapeHtml(HEADLINE)}</h2>`;
  const meta=`<div class="meta">${escapeHtml(formatDateMalayalam(new Date()))} — ${escapeHtml(formatTimeMalayalam(new Date()))}</div>`;

  container.innerHTML=`${heading}${meta}<pre>${escapeHtml(essay)}</pre>`;
}

// inject Malayalam font
(function injectFont(){
  const href="https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;600&display=swap";
  if(!document.querySelector(`link[href="${href}"]`)){
    const link=document.createElement('link'); link.rel='stylesheet'; link.href=href; document.head.appendChild(link);}
  if(!document.getElementById('elam-forecast-style')){
    const s=document.createElement('style'); s.id='elam-forecast-style';
    s.innerHTML=`#${CONTAINER_ID}{font-family:'Noto Sans Malayalam',system-ui,Arial,sans-serif;color:#111;background:#fff;padding:14px;border-radius:6px;line-height:1.6;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
    #${CONTAINER_ID} h2{margin:0 0 6px 0;font-size:1.05rem;font-weight:600;}
    #${CONTAINER_ID} .meta{color:#555;font-size:0.9rem;margin-bottom:8px;}
    #${CONTAINER_ID} pre{white-space:pre-wrap;font-family:inherit;margin:0;font-size:0.95rem;}`;
    document.head.appendChild(s);
  }
})();

// ---------------- INITIALIZE ----------------
(async function init(){
  try{await runOnceAndRender();}catch(e){console.warn("render error",e);}
  setInterval(()=>{try{runOnceAndRender();}catch(e){console.warn(e);}},AUTO_REFRESH_MS);
})();
