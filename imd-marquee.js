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
  "1": { name: "Green (No Warning)", css: "linear-gradient(90deg, #1d976c, #93f9b9)" },
  "3": { name: "Yellow alert( Be Aware)", css: "linear-gradient(90deg, #f7971e, #ffd200)" },
  "4": { name: "Orange alert( Be Prepared)", css: "linear-gradient(90deg, #f46b45, #eea849)" },
  "5": { name: "Red alert( Take Action)",    css: "linear-gradient(90deg, #cb2d3e, #ef473a)" }
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
    // Get the exact text you wanted like "Yellow alert( Be Aware)"
    const colorInfo = COLOR_MAP[colorId] || { name: "Unknown", css: "#333" };
    const warningText = decodeWarnings(data.Day_1);
    
    const dateStr = new Date().toLocaleDateString('en-GB'); // 27/04/2026

    // --- YOUR EXACT EXPECTED FORMAT ---
    marqueeTextEl.textContent = `IMD Alert for Malappuram district ${dateStr}: ${colorInfo.name} ${warningText} | Last Updated: ${data.updated_at} | Source: India Meteorological Department (IMD)`;
    
    marqueeContainerEl.style.background = colorInfo.css;

  } catch (error) {
    console.error("ELWOIC IMD Fetch Error:", error);
    marqueeTextEl.textContent = "⚠️ IMD Alert System currently offline. Please check official IMD channels.";
    marqueeContainerEl.style.background = "#222";
  }
}

document.addEventListener('DOMContentLoaded', updateMarqueeLive);
