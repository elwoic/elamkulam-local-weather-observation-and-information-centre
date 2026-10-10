const VAYU_CORE = "https://elwoic-vayu-core.bold-waterfall-0d01.workers.dev/";
 
function setEl(id,val){ const el=document.getElementById(id); if(el) el.textContent=val??"--"; }
function displayRainStatus(id,isRaining,text,isError=false){
  const r=document.getElementById(id); if(!r)return;
  if(isError) r.innerHTML=`<span class="error-status">⚠ API Error</span>`;
  else if(isRaining) r.innerHTML=`<span class="rain-status yes">🌧 ${text}</span>`;
  else r.innerHTML=`<span class="rain-status no">☀ ${text}</span>`;
}

async function loadAllData(){
  try{
    const d = await fetch(VAYU_CORE,{cache:"no-store"}).then(r=>r.json());

    // NOW columns - all calculated on backend
    setEl("owTemp0", d.now.temp); setEl("owFeels0", d.now.feels);
    setEl("owHum0", d.now.hum); setEl("owPress0", d.now.press);
    setEl("owWind0", d.now.wind); setEl("owVis0", d.now.vis);
    setEl("owCond0", d.now.cond);
    displayRainStatus("owRainBox0", d.now.isRain, d.now.rainText);

    // Forecast
    if(d.forecast[0]){ setEl("owTemp1", d.forecast[0].temp); setEl("owCond1", d.forecast[0].cond); displayRainStatus("owRainBox1", d.forecast[0].isRain, d.forecast[0].isRain?"Rain Expected":"Dry"); }
    if(d.forecast[1]){ setEl("owTemp2", d.forecast[1].temp); setEl("owCond2", d.forecast[1].cond); displayRainStatus("owRainBox2", d.forecast[1].isRain, d.forecast[1].isRain?"Rain Expected":"Dry"); }

    // Dashboard + marquee
    setEl("temp", d.dashboard.temp); setEl("humidity", d.dashboard.humidity);
    setEl("wind", d.dashboard.wind); setEl("condition", d.dashboard.condition);
    setEl("weather-marquee-1", d.dashboard.marquee1);
    setEl("weather-marquee-2", d.dashboard.marquee2);
    setEl("stationLastUpdated", `🕐 Last updated: ${new Date(d.now.updated).toLocaleTimeString("en-IN")}`);

  }catch(e){ console.error(e); }
}

// Keep your Firebase chart code as is
document.addEventListener("DOMContentLoaded", ()=>{ loadAllData(); setInterval(loadAllData,30000); });
