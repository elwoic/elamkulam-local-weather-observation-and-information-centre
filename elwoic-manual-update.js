// =============================================
//       ELWOIC AUTOMATIC UPDATE SYSTEM
// =============================================

// Get the current date and time (includes time component for accurate comparison)
const today = new Date();

// --- CSS for Flash Effect (Defined once) ---
const flashStyle = document.createElement("style");
flashStyle.innerHTML = `
    @keyframes flash {
        0%, 50%, 100% { opacity: 1; }
        25%, 75% { opacity: 0.2; }
    }
`;
document.head.appendChild(flashStyle);


/* ==================================================
    🌦️ MANUAL UPDATE SECTION — Shows UNTIL set date
================================================== */

// Set the END of the display period to the START of the next day.
// If you want the message to show until 24/11/2025 ends, set this to 2025-11-25T00:00:00.
// This example uses a future date (2026-02-01) for the main flash message.
const manualUpdateEnd = new Date("2026-02-01T00:00:00"); 

// Write here your manual update text (or leave empty)
const manualMessage =
    "**ALERT** Flash message continues until the end of January 2026!";

const defaultManual =
    "No manual updates available. Check live updates on ELWOIC.";

// Target paragraph
const manualDiv = document.getElementById("weather-message");

// Check if the current time ('today') is LESS THAN the set end time.
if (manualDiv) {
    if (today < manualUpdateEnd) {
        // Message is active. Display it with the flash effect.
        
        // Use manualMessage if provided, otherwise use a temporary default
        const displayMessage = manualMessage.trim() !== "" 
            ? manualMessage
            : "Manual update in progress and will expire soon.";

        manualDiv.innerHTML = displayMessage.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        manualDiv.style.color = "red";
        manualDiv.style.animation = "flash 1s infinite";
    } else {
        // Message is expired. Show the default text.
        manualDiv.innerText = defaultManual;
        manualDiv.style.color = "#333";
        manualDiv.style.animation = "none";
    }
}


/* ==================================================
    🌤️ PRE-UPDATE SECTION — Visible UNTIL set date
================================================== */

// Set the END of the pre-update period to the START of the next day.
// If you want the message to show until 24/11/2025 ends, set this to 2025-11-25T00:00:00.
const preUpdateEnd = new Date("2025-11-25T00:00:00"); 

// Write here your pre-update text (or leave empty)
const preUpdateMessage =
    "**Pre-Update Notice:** Site changes are expected soon. This message vanishes after 24/11/2025.";

// Default if empty or expired
const defaultPre = "No new pre-updates available at the moment.";

const preDiv = document.getElementById("preupdate-message");

if (preDiv) {
    // Check if the current time is LESS THAN the set end time AND a message is provided.
    if (today < preUpdateEnd && preUpdateMessage.trim() !== "") {
        preDiv.innerHTML = preUpdateMessage.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        preDiv.style.color = "#cc9900"; // Amber/gold color
    } else {
        preDiv.innerText = defaultPre;
        preDiv.style.color = "#999";
    }
}


/* ==================================================
    💧 REGULAR INFORMATION SECTION
================================================== */

const infoMessage =
    "This section holds supplementary information about the observation center.";

const defaultInfo = "No additional information available at this moment.";

const infoDiv = document.getElementById("info-message");

if (infoDiv) {
    // Use provided infoMessage or fallback
    infoDiv.innerText =
        infoMessage.trim() !== "" ? infoMessage : defaultInfo;

    infoDiv.style.color = "#555";
}
