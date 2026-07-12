(function(){
  const LAT = 10.908, LON = 76.229, TZ = "Asia/Kolkata";
  const hVars = ["temperature_2m","relativehumidity_2m","precipitation","precipitation_probability","wind_speed_10m","pressure_msl"].join(",");
  const dVars = ["temperature_2m_max","temperature_2m_min","precipitation_sum","windspeed_10m_max","sunrise","sunset"].join(",");
  const URL   = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=${encodeURIComponent(hVars)}&daily=${encodeURIComponent(dVars)}&current_weather=true&timezone=${encodeURIComponent(TZ)}`;

  const codeMap = {0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Foggy",51:"Light drizzle",53:"Drizzle",55:"Dense drizzle",61:"Light rain",63:"Moderate rain",65:"Heavy rain",80:"Rain showers",95:"Thunderstorm",99:"Severe thunderstorm"};
  const fmtT = s => new Date(s).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:TZ});
  const fmtD = s => new Date(s).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",timeZone:TZ});

  async function load() {
    try {
      const data = await fetch(URL).then(r => r.json());
      const cur  = data.current_weather || {};

      document.getElementById("om-temp").textContent = (cur.temperature ?? "--") + "°C";
      document.getElementById("om-cond").textContent = codeMap[cur.weathercode] || "Weather";
      document.getElementById("om-wind").textContent = cur.windspeed ? cur.windspeed.toFixed(1) + " km/h" : "--";

      let idx = -1;
      if (data.hourly && data.hourly.time) {
        idx = data.hourly.time.indexOf(cur.time || "");
        if (idx === -1) {
          const nowH = new Date().toISOString().slice(0,13);
          idx = data.hourly.time.findIndex(t => t.slice(0,13) === nowH);
        }
      }

      if (idx >= 0) {
        const H = data.hourly;
        document.getElementById("om-feels").textContent = H.temperature_2m[idx] !== undefined ? H.temperature_2m[idx].toFixed(1) + "°C" : "--";
        document.getElementById("om-hum").textContent   = H.relativehumidity_2m[idx] !== undefined ? Math.round(H.relativehumidity_2m[idx]) + "%" : "--";
        document.getElementById("om-press").textContent = H.pressure_msl[idx] !== undefined ? Math.round(H.pressure_msl[idx]) + " hPa" : "--";
      }
      document.getElementById("om-updated").textContent = "Updated: " + new Date().toLocaleTimeString("en-IN",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hour12:true});

      // Hourly strip
      const strip = document.getElementById("om-hourly");
      strip.innerHTML = "";
      if (data.hourly && idx >= 0) {
        const H = data.hourly;
        for (let i = idx; i < Math.min(H.time.length, idx + 24); i++) {
          const card = document.createElement("div");
          card.className = "hour-card";
          const pop  = H.precipitation_probability ? Math.round(H.precipitation_probability[i]) : 0;
          const rain = H.precipitation ? H.precipitation[i].toFixed(1) : "0.0";
          card.innerHTML = `<div class="hc-time">${fmtT(H.time[i])}</div>
                            <div class="hc-temp">${H.temperature_2m ? H.temperature_2m[i].toFixed(1) : "--"}°</div>
                            <div class="hc-rain">${pop}%</div>
                            <div class="hc-mm">${rain} mm</div>`;
          strip.appendChild(card);
        }
      }

      // 7-day
      const dayList = document.getElementById("om-7day");
      dayList.innerHTML = "";
      if (data.daily && data.daily.time) {
        const D = data.daily;
        D.time.forEach((t, i) => {
          const item = document.createElement("div");
          item.className = "day-item";
          item.innerHTML = `
            <div>
              <div class="day-name">${fmtD(t)}</div>
              <div class="day-sunrise">🌅 ${D.sunrise ? fmtT(D.sunrise[i]) : "--"}</div>
            </div>
            <div class="day-temps">${D.temperature_2m_max[i].toFixed(1)}° / ${D.temperature_2m_min[i].toFixed(1)}°</div>
            <div class="day-rain">${D.precipitation_sum ? D.precipitation_sum[i].toFixed(1) : "0.0"} mm</div>
            <div class="day-wind">${D.windspeed_10m_max ? D.windspeed_10m_max[i].toFixed(1) + " km/h" : "--"}</div>`;
          dayList.appendChild(item);
        });
      }
    } catch(e) {
      document.getElementById("om-cond").textContent = "Data unavailable";
    }
  }
  load();
  setInterval(load, 30 * 60 * 1000);
})();
