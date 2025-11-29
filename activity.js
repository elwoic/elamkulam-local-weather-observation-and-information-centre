/* -----------------------
   Config - use your values
   ----------------------- */
const openWeatherApiKey = "ca13a2cbdc07e7613b6af82cff262295";
const latitude = 10.9081;
const longitude = 76.2296;
const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${openWeatherApiKey}&units=metric`;

/* -----------------------
   Icons (inline SVG)
   Each function returns an SVG string (acts as image)
   ----------------------- */
function svgSwimming(){ return `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 17c3-2 6-2 9 0 3-2 6-2 9 0" stroke="#0AA5FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5.5" cy="9.5" r="1.6" fill="#0AA5FF"/><path d="M7 9s2-1 4-1 4 1 4 1" stroke="#0AA5FF" stroke-width="1.6" stroke-linecap="round"/></svg>`; }
function svgWalking(){ return `<svg viewBox="0 0 24 24"><path d="M13 4a1.5 1.5 0 1 1-0 3 1.5 1.5 0 0 1 0-3zM6 20l2-5 3-1 1 3 3 4" stroke="#003a63" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`; }
function svgRunning(){ return `<svg viewBox="0 0 24 24"><path d="M4 20s4-6 8-6 6 2 8 6" stroke="#0b7df0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="9" cy="6" r="1.6" fill="#0b7df0"/></svg>`; }
function svgCycling(){ return `<svg viewBox="0 0 24 24"><circle cx="6.5" cy="17.5" r="3" stroke="#0b7df0" stroke-width="1.6" fill="none"/><circle cx="17.5" cy="17.5" r="3" stroke="#0b7df0" stroke-width="1.6" fill="none"/><path d="M6.5 17.5L11 9l6 2" stroke="#0b7df0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`; }
function svgBiking(){ return `<svg viewBox="0 0 24 24"><path d="M3 17h2l1-3h6l1 3h2" stroke="#374151" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="7" cy="17" r="2" stroke="#374151" stroke-width="1.6" fill="none"/><circle cx="17" cy="17" r="2" stroke="#374151" stroke-width="1.6" fill="none"/></svg>`; }
function svgClimbing(){ return `<svg viewBox="0 0 24 24"><path d="M6 20l6-9 3 3 3-2-4-5-6 6-2-2-4 9" stroke="#2f855a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
function svgFishing(){ return `<svg viewBox="0 0 24 24"><path d="M4 20s5-1 8-4 8-6 8-6" stroke="#2b6cb0" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M10 8l4 4" stroke="#2b6cb0" stroke-width="1.6" stroke-linecap="round"/></svg>`; }
function svgClothes(){ return `<svg viewBox="0 0 24 24"><path d="M7 2l1.5 3h7L17 2" stroke="#b35c00" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M4 9h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z" stroke="#b35c00" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`; }

/* -----------------------
   Recommendation logic
   - returns: 'good' | 'moderate' | 'avoid'
   - uses temp (°C), humidity (%), wind (km/h), condition (string)
   ----------------------- */

function recommendFor(activity, temp, humidity, wind, condition){
  const c = condition.toLowerCase();
  const isRain = /rain|drizzle|thunder|storm/i.test(c);
  const isThunder = /thunder|storm/i.test(c);
  const isClear = /clear|sun/i.test(c);
  const isCold = temp <= 12;
  const isHot = temp >= 35;

  switch(activity){
    case "swimming":
      // thunder or heavy wind -> avoid; rain okay but not thunder; very cold -> avoid
      if (isThunder || wind >= 35 || isCold) return "avoid";
      if (isRain && !isThunder) return "moderate";
      if (temp >= 24 && wind < 25 && !isRain) return "good";
      return "moderate";

    case "walking":
      if (isThunder) return "avoid";
      if (isRain && wind >= 25) return "avoid";
      if (isRain) return "moderate";
      if (isHot) return "moderate";
      return "good";

    case "running":
      if (isThunder) return "avoid";
      if (isRain && wind >= 30) return "avoid";
      if (isRain) return "moderate";
      if (isHot) return "moderate";
      if (isCold) return "moderate";
      return "good";

    case "cycling":
      // cycling vulnerable to wind and rain
      if (isThunder || wind >= 35) return "avoid";
      if (isRain && wind >= 25) return "avoid";
      if (isRain) return "moderate";
      if (wind >= 25) return "moderate";
      return "good";

    case "biking": // motorbike trips
      if (isThunder || wind >= 35) return "avoid";
      if (isRain && wind >= 25) return "avoid";
      if (isRain) return "moderate";
      if (wind >= 30) return "moderate";
      return "good";

    case "climbing":
      // climbing very sensitive to wind and rain
      if (isThunder || isRain || wind >= 30) return "avoid";
      if (wind >= 20) return "moderate";
      return "good";

    case "fishing":
      // thunder dangerous; light rain is okay; high winds not good
      if (isThunder || wind >= 40) return "avoid";
      if (wind >= 30) return "moderate";
      if (isRain) return "moderate";
      return "good";

    case "drying":
      // drying clothes outside needs no rain + not too humid
      if (isRain) return "avoid";
      if (humidity >= 80) return "avoid";
      if (humidity >= 65) return "moderate";
      return (isClear ? "good" : "moderate");

    case "outdoor":
    default:
      // general outdoor going
      if (isThunder) return "avoid";
      if (isRain && wind >= 30) return "avoid";
      if (isRain) return "moderate";
      if (isHot || isCold) return "moderate";
      return "good";
  }
}

/* -----------------------
   Render utilities
   ----------------------- */

function severityClass(s){
  if(s === "good") return "s-good";
  if(s === "moderate") return "s-moderate";
  return "s-avoid";
}

function severityText(s){
  if(s === "good") return "Good";
  if(s === "moderate") return "Moderate";
  return "Not recommended";
}

/* activity list in desired order */
const activities = [
  { key:"swimming", label:"Swimming", icon: svgSwimming },
  { key:"walking", label:"Walking", icon: svgWalking },
  { key:"running", label:"Running", icon: svgRunning },
  { key:"cycling", label:"Cycling (bicycle)", icon: svgCycling },
  { key:"biking", label:"Biking (motorbike)", icon: svgBiking },
  { key:"climbing", label:"Climbing", icon: svgClimbing },
  { key:"fishing", label:"Fishing", icon: svgFishing },
  { key:"drying", label:"Drying clothes outdoors", icon: svgClothes }
];

/* hint text templates based on severity (short) */
function adviceText(activityKey, severity){
  const map = {
    swimming: {
      good: "Safe to swim — no thunder and suitable temperature.",
      moderate: "Possible but be cautious — conditions not ideal.",
      avoid: "Avoid swimming—dangerous conditions (thunder, cold, or strong winds)."
    },
    walking: {
      good: "Good for walking — comfortable and safe.",
      moderate: "Moderate — rain/heat may make walking less comfortable.",
      avoid: "Avoid walking due to dangerous weather (thunder/heavy wind)."
    },
    running: {
      good: "Good for running — safe conditions for light to moderate exercise.",
      moderate: "Moderate — consider reducing effort or running time.",
      avoid: "Avoid running due to severe weather (thunder/high wind)."
    },
    cycling: {
      good: "Good for cycling — roads and winds are favourable.",
      moderate: "Moderate — light rain or wind may affect balance.",
      avoid: "Avoid cycling — hazardous due to heavy rain or strong winds."
    },
    biking: {
      good: "Safe for motorbike travel — drive carefully as always.",
      moderate: "Moderate — take care; rain or wind may affect handling.",
      avoid: "Avoid motorbike trips — too dangerous in current weather."
    },
    climbing: {
      good: "Good for climbing — stable and safe conditions.",
      moderate: "Moderate — wind or damp can make climbing riskier.",
      avoid: "Avoid climbing — slippery or stormy conditions are risky."
    },
    fishing: {
      good: "Good for fishing — calm waters and safe conditions.",
      moderate: "Moderate — check wind and rain before going out.",
      avoid: "Avoid fishing due to thunderstorms or very strong winds."
    },
    drying: {
      good: "Good — sunny/clear and low humidity for drying clothes.",
      moderate: "Moderate — may take longer due to humidity or light clouds.",
      avoid: "Avoid drying outside — rain or very high humidity will prevent drying."
    }
  };
  return (map[activityKey] && map[activityKey][severity]) || "Recommendation unavailable.";
}

/* -----------------------
   Main: fetch weather and render cards
   ----------------------- */
async function updateActivityRecommendations(){
  const grid = document.getElementById("activityGrid");
  const lastUpdated = document.getElementById("lastUpdated");

  // clear and show placeholders
  grid.innerHTML = "";
  activities.forEach(() => {
    const ph = document.createElement("div");
    ph.className = "card";
    ph.innerHTML = `<div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#eef"/></svg></div>
                    <div class="body"><div class="title">Loading...</div><div class="advice">Please wait</div></div>`;
    grid.appendChild(ph);
  });

  try {
    const resp = await fetch(weatherURL);
    if(!resp.ok) throw new Error("Weather API returned " + resp.status);
    const data = await resp.json();

    const temp = (data.main && typeof data.main.temp === "number") ? data.main.temp : 0;
    const humidity = (data.main && typeof data.main.humidity === "number") ? data.main.humidity : 0;
    const wind = (data.wind && typeof data.wind.speed === "number") ? data.wind.speed * 3.6 : 0; // m/s -> km/h
    const condition = (data.weather && data.weather[0] && data.weather[0].main) ? data.weather[0].main : "Unknown";

    // rebuild grid with real cards
    grid.innerHTML = ""; // clear placeholders
    activities.forEach(a => {
      const severity = recommendFor(a.key, temp, humidity, wind, condition);
      const cls = severityClass(severity);
      const title = a.label;
      const advice = adviceText(a.key, severity);

      const card = document.createElement("div");
      card.className = `card ${cls}`;

      const iconWrap = document.createElement("div");
      iconWrap.className = "icon";
      iconWrap.setAttribute("aria-hidden","true");
      iconWrap.innerHTML = a.icon();

      const body = document.createElement("div");
      body.className = "body";

      const t = document.createElement("div");
      t.className = "title";
      t.textContent = title;

      const p = document.createElement("div");
      p.className = "advice";
      p.textContent = `${severityText(severity)} — ${advice}`;

      body.appendChild(t);
      body.appendChild(p);
      card.appendChild(iconWrap);
      card.appendChild(body);
      grid.appendChild(card);
    });

    lastUpdated.textContent = "Last updated: " + new Date().toLocaleString();
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:12px;border-radius:10px;background:#fff2f2;border-left:6px solid var(--avoid-border);">Failed to load weather. Please check your connection or API key. (${err.message})</div>`;
    lastUpdated.textContent = "Last updated: --";
    console.error(err);
  }
}

// initial load + periodic refresh (every 10 minutes)
updateActivityRecommendations();
setInterval(updateActivityRecommendations, 10 * 60 * 1000);
