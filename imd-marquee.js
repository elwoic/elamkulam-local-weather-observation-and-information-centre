// imd-marquee.js

// Preset alert data
const alerts = {
  "2025-12-01": { text: "IMD Alert For Malappuram District: g" },
  "2025-12-02": { text: "IMD Alert For Malappuram District: y" },
  "2025-12-03": { text: "IMD Alert For Malappuram District: y" },
  "2025-12-04": { text: "IMD Alert For Malappuram District: y" },
  "2025-12-05": { text: "IMD Alert For Malappuram District: g" }
};

// Last updated time (manual)
const lastUpdated = "2025-12-1 9:42 PM";

// Function to update the marquee
function updateMarquee(marqueeTextEl, marqueeContainerEl) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const bgColors = {
    green: "linear-gradient(90deg, #009900, #33cc33)",
    yellow: "linear-gradient(90deg, #ffcc00, #ffee33)",
    orange: "linear-gradient(90deg, #ff6600, #ff9933)",
    red: "linear-gradient(90deg, #cc0000, #ff3333)",
    default: "linear-gradient(90deg, #444, #888)"
  };

  const levelMap = {
    g: { color: "green", full: "Green" },
    y: { color: "yellow", full: "Yellow" },
    o: { color: "orange", full: "Orange" },
    r: { color: "red", full: "Red" }
  };

  // Find the latest alert date
  const alertDates = Object.keys(alerts).sort(); // ascending order
  const lastAlertDate = alertDates[alertDates.length - 1];

  let displayText;
  let bgColor;

  if (todayKey in alerts) {
    // Today has an alert
    let alertText = alerts[todayKey].text;
    const shortCode = alertText.slice(-1).toLowerCase();
    const mapping = levelMap[shortCode] || { color: "default", full: "Unknown" };
    alertText = alertText.replace(/([oyrg])$/i, mapping.full);

    displayText = `Today ${dd}/${mm}/${yyyy}, ${alertText}  |  Last Updated: ${lastUpdated}`;
    bgColor = bgColors[mapping.color] || bgColors.default;

  } else if (todayKey > lastAlertDate) {
    // All preset alert dates are over
    displayText = `Today ${dd}/${mm}/${yyyy}: IMD alert for Malappuram District is not available`;
    bgColor = bgColors.default;

  } else {
    // Date is within preset range but no alert for today
    displayText = `⚠️ Updated data unavailable for ${dd}/${mm}/${yyyy}.  |  Last Updated: ${lastUpdated}`;
    bgColor = bgColors.default;
  }

  // Update marquee
  marqueeTextEl.textContent = displayText;
  marqueeContainerEl.style.background = bgColor;
}
// ... (existing updateMarquee function code above)

// --- Add this block at the end of imd-marquee.js ---
// Wait for the DOM to be fully loaded before trying to access the elements
document.addEventListener('DOMContentLoaded', (event) => {
    // Get the elements by their IDs
    const marqueeTextEl = document.getElementById("marqueeText");
    const marqueeContainerEl = document.getElementById("marqueeContainer");

    // Check if the elements exist before calling the function
    if (marqueeTextEl && marqueeContainerEl) {
        // Call the function to update the marquee
        updateMarquee(marqueeTextEl, marqueeContainerEl);
    } else {
        console.error("Marquee elements not found in the DOM.");
    }
});
