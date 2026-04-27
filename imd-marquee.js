const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

// Standard IMD Code Decodes
const WARNING_MAP = {
  "1": "Very Heavy Rain",
  "4": "Thunderstorm & Lightning",
  "8": "Gusty Winds",
  "10": "Heavy Rain",
  "12": "Extremely Heavy Rain",
  "16": "Squall"
};

// Standard IMD Color Mapping
const COLOR_MAP = {
  "1": { name: "Green", css: "linear-gradient(90deg, #1d976c, #93f9b9)" }, // Green
  "3": { name: "Yellow", css: "linear-gradient(90deg, #f7971e, #ffd200)" }, // Yellow
  "4": { name: "Orange", css: "linear-gradient(90deg, #f46b45, #eea849)" }, // Orange
  "5": { name: "Red",    css: "linear-gradient(90deg, #cb2d3e, #ef473a)" }  // Red
};

function decodeWarnings(codeString) {
  if (!codeString || codeString === "0") return "No Specific Warning";
  return codeString.split(',')
    .map(code => WARNING_MAP[code.trim()] || `Weather Event ${code}`)
    .join(" & ");
}

async function updateMarqueeLive() {
  const marqueeTextEl = document.getElementById("marqueeText");
  const marqueeContainerEl = document.getElementById("marqueeContainer");

  try {
    const response = await fetch(WORKER_URL);
    const data = await response.json();

    if (data.error) throw new Error(data.error);

    const colorId = data.Day1_Color;
    const colorInfo = COLOR_MAP[colorId] || { name: "Unknown", css: "#333" };
    const warningText = decodeWarnings(data.Day_1);
    
    // Check for serious upcoming weather (Orange/Red) on other days
    let upcomingNote = "";
    if (data.Day5_Color === "4" || data.Day5_Color === "5") {
      upcomingNote = ` | ⚠️ Notice: ${COLOR_MAP[data.Day5_Color].name} alert issued for later this week.`;
    }

    const dateStr = new Date().toLocaleDateString('en-GB');

    // Final Display String
    marqueeTextEl.innerHTML = `
      <strong>IMD MALAPPURAM ALERT (${dateStr}):</strong> 
      ${colorInfo.name.toUpperCase()} ALERT - ${warningText}${upcomingNote} 
      <small>(Last Updated: ${data.updated_at})</small> 
      | Source: India Meteorological Department
    `;
    
    marqueeContainerEl.style.background = colorInfo.css;

  } catch (error) {
    console.error("ELWOIC IMD Fetch Error:", error);
    marqueeTextEl.textContent = "⚠️ IMD Alert System currently offline. Please check official IMD channels.";
    marqueeContainerEl.style.background = "#222";
  }
}

document.addEventListener('DOMContentLoaded', updateMarqueeLive);
