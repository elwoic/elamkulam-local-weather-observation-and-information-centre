// ---------------------------
// CONFIGURATION
// ---------------------------
const OPENWEATHER_API_KEY = "ca13a2cbdc07e7613b6af82cff262295"; // OpenWeatherMap API key
const LAT = 10.9081;
const LON = 76.2296;
const CONTAINER_ID = "elamkulam-forecast-report";
const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour
const HEADLINE = "എലങ്കുളം കാലാവസ്ഥാ സമഗ്ര റിപ്പോർട്ട്";

// ---------------------------
// UTILS
// ---------------------------
function pad(n){ return String(n).padStart(2,'0'); }
function formatDateMalayalam(d){ 
  const MONTHS_ML = ["ജനുവരി","ഫെബ്രുവരി","മാർച്ച്","ഏപ്രിൽ","മേയ്","ജൂൺ","ജൂലൈ","ഓഗസ്റ്റ്","സെപ്റ്റംബർ","ഒക്ടോബർ","നവംബർ","ഡിസംബർ"];
  return `${pad(d.getDate())} ${MONTHS_ML[d.getMonth()]} ${d.getFullYear()}`;
}
function formatTimeMalayalam(d){ return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function msToKmh(ms){ return ms*3.6; }

// ---------------------------
// FETCH CURRENT WEATHER
// ---------------------------
async function fetchWeatherSnapshot(){
  // OpenWeatherMap
  const owRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OPENWEATHER_API_KEY}&units=metric`);
  const owData = await owRes.json();
  const temp = owData.main?.temp ?? null;
  const feels = owData.main?.feels_like ?? null;
  const humidity = owData.main?.humidity ?? null;
  const wind = owData.wind?.speed ?? null;
  const windDeg = owData.wind?.deg ?? null;
  const condition = owData.weather?.[0]?.main ?? null;
  const visibility = owData.visibility ?? null;

  // Open-Meteo
  const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m`;
  const omRes = await fetch(omUrl);
  const omData = await omRes.json();
  const omTemp = omData.current_weather?.temperature ?? null;
  const omWind = omData.current_weather?.windspeed ?? null;

  return { temp, feels, humidity, wind, windDeg, condition, visibility, omTemp, omWind };
}

// ---------------------------
// GENERATE MALAYALAM ESSAY
// ---------------------------
function generateEssay(weather){
  const now = new Date();
  const s = [];
  s.push(HEADLINE);
  s.push(`${formatDateMalayalam(now)} — ${formatTimeMalayalam(now)}`);
  s.push("");

  if(weather.temp!=null){
    s.push(`ഇപ്പോൾ പ്രദേശത്ത് താപനില ${weather.temp.toFixed(1)}°C ആണ്. അനുഭവ താപനില ${weather.feels?.toFixed(1)}°C ആണ്.`);
  }else{
    s.push("ഇപ്പോൾ താപനില രേഖപ്പെടുത്തിയിട്ടില്ല.");
  }

  if(weather.humidity!=null){
    s.push(`വാതാവിലെ ഈർപ്പതോത് നിലവിൽ ${weather.humidity}% ആണ്.`);
  }

  if(weather.wind!=null){
    s.push(`കാറ്റിന്റെ വേഗം ഏകദേശം ${(msToKmh(weather.wind)).toFixed(1)} km/h ആണ്.`);
    if(weather.windDeg!=null){
      s.push(`കാറ്റ് ${weather.windDeg}° ദിശയിൽ വീശുന്നു.`);
    }
  }

  if(weather.condition) s.push(`പ്രധാന കാലാവസ്ഥാ അവസ്ഥ: ${weather.condition}.`);
  if(weather.visibility!=null) s.push(`ദൃശ്യപരിധി: ${(weather.visibility/1000).toFixed(1)} km`);

  if(weather.omTemp!=null) s.push(`Open-Meteo പ്രകാരം നിലവിലെ താപനില: ${weather.omTemp.toFixed(1)}°C`);
  if(weather.omWind!=null) s.push(`Open-Meteo പ്രകാരം കാറ്റിന്റെ വേഗം: ${weather.omWind.toFixed(1)} km/h`);

  s.push("ഈ റിപ്പോർട്ട് ലഭ്യമായ ഡാറ്റകൾ അടിസ്ഥാനമാക്കി തയ്യാറാക്കിയതാണ്; ഔദ്യോഗിക മുന്നറിയിപ്പുകൾക്കായി IMD അറിയിപ്പ് പരിശോധിക്കുക.");
  return s.join("\n\n");
}

// ---------------------------
// RENDER
// ---------------------------
async function renderForecast(){
  const container = document.getElementById(CONTAINER_ID);
  if(!container) return;

  container.innerHTML = `<div class="meta">അപ്‌ഡേറ്റ് ചെയ്യുന്നു — ${formatTimeMalayalam(new Date())}</div>`;

  try{
    const weather = await fetchWeatherSnapshot();
    const essay = generateEssay(weather);
    container.innerHTML = `<pre>${essay}</pre>`;
  }catch(err){
    console.error("Weather fetch failed:", err);
    container.innerHTML = `<div class="meta">Error fetching data</div>`;
  }
}

// ---------------------------
// INIT + AUTO REFRESH
// ---------------------------
renderForecast();
setInterval(renderForecast, AUTO_REFRESH_MS);
