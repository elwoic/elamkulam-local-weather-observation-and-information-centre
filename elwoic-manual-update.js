/* ============================================================
   ELWOIC — SMART AUTO UPDATE SYSTEM
   Manual = today's message only
   Pre-update = tomorrow's message (moves to manual after midnight)
   ============================================================ */


/* ---------------------------
   0. Helper: Convert DD/MM/YYYY
---------------------------- */
function parseDate(ddmmyyyy) {
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d);  // midnight of that day
}


/* ---------------------------
   1. User writes messages HERE
---------------------------- */

// Message for a specific day
const manualDate = "30/11/2025";       // Manual update day
const manualText = "Rain expected at 5:00 Pm";

// Pre-update: message for the tomorrow
const preDate = "28/11/2025";          // Tomorrow's date
const preText = "No manual updates. Site under valuation";


/* ---------------------------
   2. Default messages
---------------------------- */
const defaultManual = "No manual updates available.";
const defaultPre = "No new pre-updates.";
const defaultInfo = "No additional information.";


/* ---------------------------
   3. Convert dates
---------------------------- */
const today = new Date();
today.setHours(18,30,0,0);  // remove time part

const manualDay = parseDate(manualDate);
const preDay = parseDate(preDate);



/* ---------------------------
   4. Select HTML IDs
---------------------------- */
const manualDiv = document.getElementById("weather-message");
const preDiv = document.getElementById("preupdate-message");
const infoDiv = document.getElementById("info-message");


/* ============================================================
   5. MAIN LOGIC
============================================================ */
if (manualDiv) {

    // Case A — TODAY = manual update day
    if (today.getTime() === manualDay.getTime()) {
        manualDiv.innerHTML = manualText;
        manualDiv.classList.add("blink-alert");
    }

    // Case B — TODAY = pre-update day (pre becomes manual)
    else if (today.getTime() === preDay.getTime()) {
        manualDiv.innerHTML = preText;
        manualDiv.classList.add("blink-alert");
    }

    // Case C — default day
    else {
        manualDiv.innerHTML = defaultManual;
        manualDiv.classList.remove("blink-alert"); // remove blinking when showing default
    }
}




/* ============================================================
   6. PRE-UPDATE DISPLAY
   - Show pre only BEFORE its day starts
   - Hide pre once that day arrives
   ============================================================ */

if (preDiv) {

    // Before the pre-update day → show tomorrow's info
    if (today.getTime() < preDay.getTime()) {
        preDiv.innerHTML = preText;

    // On or after pre-update day → reset
    } else {
        preDiv.innerHTML = defaultPre;
    }
}


/* ============================================================
   7. INFORMATION SECTION (Static)
 ============================================================ */
if (infoDiv) {
    infoDiv.innerHTML = defaultInfo;
}
