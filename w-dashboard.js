  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDo3Rm9PBZ8GZqOucYh1VyCCc3hBPLbTn4",
    authDomain: "report-20d26.firebaseapp.com",
    databaseURL: "https://report-20d26-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "report-20d26"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const API_URL = "https://curly-sound-5bea.elwoicelamkulam.workers.dev/api";
const OW_KEY = "ca13a2cbdc07e7613b6af82cff262295";
const LAT = 10.9081; 
const LON = 76.2296;

let currentLogData = {};


// Utility functions (AQI, Feels Like) - Kept from your original
const pm25ToAQI = (pm) => {
    const bp = [{cL:0,cH:12,aL:0,aH:50},{cL:12.1,cH:35.4,aL:51,aH:100},{cL:35.5,cH:55.4,aL:101,aH:150},{cL:55.5,cH:150.4,aL:151,aH:200},{cL:150.5,cH:250.4,aL:201,aH:300},{cL:250.5,cH:500,aL:301,aH:500}];
    const r = bp.find(range => pm >= range.cL && pm <= range.cH) || bp[0];
    return Math.round(((r.aH-r.aL)/(r.cH-r.cL))*(pm-r.cL)+r.aL);
};

const getAQIStatus = (aqi) => {
    if (aqi <= 50) return "Excellent"; if (aqi <= 100) return "Good"; if (aqi <= 150) return "Moderate";
    if (aqi <= 200) return "Unhealthy"; if (aqi <= 300) return "Very Unhealthy"; return "Hazardous";
};

const getRealisticFeelsLike = (t, rh, apiFeels) => {
    if (t < 26) return t.toFixed(1);
    const T = (t * 9/5) + 32;
    let hi = -42.379 + 2.04901523*T + 10.14333127*rh - 0.22475541*T*rh - 0.00683783*T*T - 0.05481717*rh*rh + 0.00122874*T*T*rh + 0.00085282*T*rh*rh - 0.00000199*T*T*rh*rh;
    return (((hi-32)*5/9) * 0.3 + apiFeels * 0.7).toFixed(1);
};

async function loadWeatherSnapshot() {
    try {
        const [workerRes, owRes, omRes] = await Promise.all([
            fetch(API_URL).then(r=>r.json()),
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${OW_KEY}&units=metric`).then(r=>r.json()),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&hourly=relativehumidity_2m&timezone=Asia/Kolkata`).then(r=>r.json())
        ]);

        const localT = owRes.main.temp;
        const localH = workerRes.rhum_corrected;
        const pm25Val = workerRes.pm02_corrected;
        const aqiVal = pm25ToAQI(pm25Val);
        const visibilityKm = parseFloat((owRes.visibility/1000).toFixed(1));
        const realFeels = getRealisticFeelsLike(localT, localH, owRes.main.feels_like);
        const avgWind = ((owRes.wind.speed*3.6 + omRes.current_weather.windspeed)/2).toFixed(1);
        const omH = omRes.hourly.relativehumidity_2m[new Date().getHours()];

        document.getElementById("temp").textContent = localT.toFixed(1);
        document.getElementById("humidity").textContent = localH;
        document.getElementById("feels").textContent = realFeels;
        document.getElementById("visibility").textContent = visibilityKm;
        document.getElementById("wind").textContent = avgWind;
        document.getElementById("om-temp").textContent = ((owRes.main.temp + omRes.current_weather.temperature)/2).toFixed(1);
        document.getElementById("om-humidity").textContent = Math.round((owRes.main.humidity + omH)/2);
        document.getElementById("pressure").textContent = owRes.main.pressure;
        document.getElementById("condition").textContent = owRes.weather[0].main;
        document.getElementById("last-updated").textContent = new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit"});

        currentLogData = {
            temp_c: localT,
            humidity: localH,
            pm25: pm25Val,
            feels_like_c: parseFloat(realFeels),
            aqi: aqiVal,
            aqi_status: getAQIStatus(aqiVal),
            pressure_hpa: owRes.main.pressure,
            wind_kmh: parseFloat(avgWind),
            visibility_km: visibilityKm,
            condition: owRes.weather[0].main,
            timestamp_utc: new Date().toISOString(),
            timestamp_ist: new Date().toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})
        };

        window.lastWeatherMeta = { cloudPercent: owRes.clouds?.all || 0, visibilityKm, humidity: localH, temperature: localT, hour: new Date().getHours() };
    } catch(err){ console.error(err); }
}

// MODAL HANDLING
const showModal = (msg) => {
    document.getElementById("cond-modal-msg").textContent = msg;
    document.getElementById("cond-modal").style.display = "flex";
};

document.getElementById("condition-box").onclick = () => {
    if(!window.lastWeatherMeta) return;

    const d = window.lastWeatherMeta;

    let message = `ഇപ്പോൾ ഏലംകുളത്തിലെ കാലാവസ്ഥ: താപനില ${d.temperature}°C, ആർദ്രത ${d.humidity}% ആണ്.`;

    if(d.cloudPercent > 70){
        message += " ആകാശം മേഘാവൃതമാണ്.";
    } else if(d.cloudPercent > 40){
        message += " ഭാഗികമായി മേഘാവൃതമായ ആകാശം.";
    } else {
        message += " ആകാശം കൂടുതലും തെളിഞ്ഞതാണ്.";
    }

    if(d.visibilityKm < 5){
        message += " ദൃശ്യപരിധി കുറവാണ്.";
    } else {
        message += " ദൃശ്യപരിധി നല്ലതാണ്.";
    }

    showModal(message);
};

document.getElementById("cond-modal-close").onclick = () => document.getElementById("cond-modal").style.display = "none";

// Secret Bypass
document.getElementById("secret-trigger").ondblclick = async () => {
    const pass = prompt("Enter admin code:");
    if(pass === "5252") {
        const bypassData = {...currentLogData, timestamp_utc: new Date(Date.now() - 31*60*1000).toISOString()};
        await push(ref(db, "weather_logs"), bypassData);
    }
};

loadWeatherSnapshot();
setInterval(loadWeatherSnapshot, 10*60*1000);
