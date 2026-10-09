const AQI_API = "https://curly-sound-5bea.elwoicelamkulam.workers.dev/api";

async function updateAQI(){
  try{
    const res = await fetch(AQI_API);
    if(!res.ok) throw new Error('AQI fetch failed');
    const d = await res.json();
    if(d.error) throw new Error(d.message);

    // dot + pulse
    document.getElementById('aqi-dot').style.background = d.colors.aqi;
    document.getElementById('aqi-pulse').style.background = d.colors.aqi;

    // status text
    document.getElementById('aqi-status-text').textContent = d.display.statusText;

    // wood stove alert - no logic, just show/hide
    document.getElementById('wood-stove-alert').style.display = d.display.showWoodStoveAlert? 'block' : 'none';

    // advice
    document.getElementById('aqi-advice').innerHTML = `${d.display.adviceEn}<br><span style="font-family:'Noto Sans Malayalam',sans-serif;">${d.display.adviceMl}</span><br><small style="color:var(--text-muted);">${d.display.pmText}</small>`;

    // sensors - direct values and colors
    const set = (id, value, color) => {
      const el = document.getElementById(id);
      if(el) el.textContent = value;
      const bar = document.getElementById(id+'-bar');
      if(bar) bar.style.background = color;
    };

    set('aqi-pm10', d.pm10, d.colors.pm10);
    set('aqi-co2', d.co2, d.colors.co2);
    set('aqi-tvoc', d.tvoc, d.colors.tvoc);
    set('aqi-nox', d.nox, d.colors.nox);

    document.getElementById('aqi-time').textContent = d.display.time;

  } catch(e){
    console.error(e);
    document.getElementById('aqi-status-text').textContent='Offline';
  }
}

updateAQI();
setInterval(updateAQI, 180000);
