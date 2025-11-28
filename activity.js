/* Weather API (Kerala - Elamkulam) */
const apiKey = "ca13a2cbdc07e7613b6af82cff262295";
const lat = 10.9081;
const lon = 76.2296;
const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;

/* Inline SVG icon functions */
function svgSwimming(){ return `<svg viewBox="0 0 24 24"><path d="M2 17c3-2 6-2 9 0 3-2 6-2 9 0" stroke="#0AA5FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5.5" cy="9.5" r="1.6" fill="#0AA5FF"/><path d="M7 9s2-1 4-1 4 1 4 1" stroke="#0AA5FF" stroke-width="1.6" stroke-linecap="round"/></svg>`; }
function svgWalking(){ return `<svg viewBox="0 0 24 24"><path d="M13 4a1.5 1.5 0 1 1-0 3 1.5 1.5 0 0 1 0-3zM6 20l2-5 3-1 1 3 3 4" stroke="#003a63" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`; }
function svgRunning(){ return `<svg viewBox="0 0 24 24"><path d="M4 20s4-6 8-6 6 2 8 6" stroke="#0b7df0" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="6" r="1.6" fill="#0b7df0"/></svg>`; }
function svgCycling(){ return `<svg viewBox="0 0 24 24"><circle cx="6.5" cy="17.5" r="3" stroke="#0b7df0" stroke-width="1.6" fill="none"/><circle cx="17.5" cy="17.5" r="3" stroke="#0b7df0" stroke-width="1.6" fill="none"/><path d="M6.5 17.5L11 9l6 2" stroke="#0b7df0" stroke-width="1.6" fill="none"/></svg>`; }
function svgBiking(){ return `<svg viewBox="0 0 24 24"><path d="M3 17h2l1-3h6l1 3h2" stroke="#374151" stroke-width="1.6" fill="none"/><circle cx="7" cy="17" r="2" stroke="#374151" stroke-width="1.6" fill="none"/><circle cx="17" cy="17" r="2" stroke="#374151" stroke-width="1.6" fill="none"/></svg>`; }
function svgClimbing(){ return `<svg viewBox="0 0 24 24"><path d="M6 20l6-9 3 3 3-2-4-5-6 6-2-2-4 9" stroke="#2f855a" stroke-width="1.6" fill="none"/></svg>`; }
function svgFishing(){ return `<svg viewBox="0 0 24 24"><path d="M4 20s5-1 8-4 8-6 8-6" stroke="#2b6cb0" stroke-width="1.6" fill="none"/><path d="M10 8l4 4" stroke="#2b6cb0" stroke-width="1.6"/></svg>`; }
function svgClothes(){ return `<svg viewBox="0 0 24 24"><path d="M7 2l1.5 3h7L17 2" stroke="#b35c00" stroke-width="1.5" fill="none"/><path d="M4 9h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" stroke="#b35c00" stroke-width="1.5" fill="none"/></svg>`; }

/* Activity order */
const activities = [
  { key:"swimming", label:"Swimming", icon:svgSwimming },
  { key:"walking", label:"Walking", icon:svgWalking },
  { key:"running", label:"Running", icon:svgRunning },
  { key:"cycling", label:"Cycling (bicycle)", icon:svgCycling },
  { key:"biking", label:"Biking (motorbike)", icon:svgBiking },
  { key:"climbing", label:"Climbing", icon:svgClimbing },
  { key:"fishing", label:"Fishing", icon:svgFishing },
  { key:"drying", label:"Drying clothes outdoors", icon:svgClothes }
];

/* Recommendation logic */
function recommendFor(activity, temp, humidity, wind, cond){
  const c = cond.toLowerCase();
  const rain = /rain|drizzle|storm/i.test(c);
  const thunder = /thunder|storm/i.test(c);
  const cold = temp <= 12;
  const hot = temp >= 35;

  switch(activity){
    case "swimming": if(thunder||wind>=35||cold) return "avoid"; if(rain) return "moderate"; return "good";
    case "walking": if(thunder) return "avoid"; if(rain&&wind>=25) return "avoid"; if(rain||hot) return "moderate"; return "good";
    case "running": if(thunder) return "avoid"; if(rain&&wind>=30) return "avoid"; if(rain||hot||cold) return "moderate"; return "good";
    case "cycling": if(thunder||wind>=35) return "avoid"; if(rain&&wind>=25) return "avoid"; if(rain||wind>=25) return "moderate"; return "good";
    case "biking": if(thunder||wind>=35) return "avoid"; if(rain&&wind>=25) return "avoid"; if(rain||wind>=30) return "moderate"; return "good";
    case "climbing": if(thunder||rain||wind>=30) return "avoid"; if(wind>=20) return "moderate"; return "good";
    case "fishing": if(thunder||wind>=40) return "avoid"; if(wind>=30||rain) return "moderate"; return "good";
    case "drying": if(rain||humidity>=80) return "avoid"; if(humidity>=65) return "moderate"; return "good";
  }
  return "good";
}

function sevClass(s){ return s==="good"?"s-good":s==="moderate"?"s-moderate":"s-avoid"; }
function sevText(s){ return s==="good"?"Good":s==="moderate"?"Moderate":"Not recommended"; }

/* Display logic */
async function updateActivity(){
  const g = document.getElementById("activityGrid");
  const stamp = document.getElementById("lastUpdated");
  g.innerHTML = "<div>Loading...</div>";

  try{
    const res = await fetch(weatherURL);
    const d = await res.json();
    const t = d.main.temp;
    const hum = d.main.humidity;
    const wind = d.wind.speed * 3.6;
    const cond = d.weather[0].main;

    g.innerHTML = "";
    activities.forEach(a=>{
      const level = recommendFor(a.key,t,hum,wind,cond);
      const div = document.createElement("div");
      div.className = "card " + sevClass(level);
      div.innerHTML = `
        <div class="icon">${a.icon()}</div>
        <div class="body">
          <div class="title">${a.label}</div>
          <div class="advice">${sevText(level)}</div>
        </div>`;
      g.appendChild(div);
    });

    stamp.textContent = "Last updated: " + new Date().toLocaleString();
  } catch {
    g.innerHTML = `<div class="card s-avoid">Weather fetch failed</div>`;
  }
}

updateActivity();
setInterval(updateActivity, 10 * 60 * 1000);

