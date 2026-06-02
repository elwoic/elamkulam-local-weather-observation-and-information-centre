document.addEventListener("DOMContentLoaded", () => {
  const panel    = document.getElementById("alerts-panel");
  const manualEl = document.getElementById("alert-manual");
  const preEl    = document.getElementById("alert-pre");
  const infoEl   = document.getElementById("alert-info");
  const timeEl   = document.getElementById("alert-timestamp");

  // Point this to your published Cloudflare Worker domain URL
  const WORKER_URL = "https://elwoic-manual-update.bold-waterfall-0d01.workers.dev";

  /* ── IMMEDIATE LOADING STATE ── */
  const loadingHtml = `
    <div class="loading-text">
      <div class="spinner-wrapper">
        <div class="spinner-ring"></div>
        <div class="spinner-dot"></div>
      </div>
      <span>Connecting to database...</span>
    </div>`;

  if (panel) {
    panel.style.display = "block";
    if (manualEl) manualEl.innerHTML = loadingHtml;
    if (preEl)    preEl.innerHTML    = loadingHtml;
    if (infoEl)   infoEl.innerHTML   = loadingHtml;
  }

  function parseDateTs(ddmmyyyy) {
    if (!ddmmyyyy) return NaN;
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  /* ── FETCH DATA LAYER FROM WORKER ── */
  async function fetchLiveAlerts() {
    try {
      const res = await fetch(`${WORKER_URL}/api/live`);
      if (!res.ok) throw new Error("Network status response returned errors.");
      const data = await res.json() || {};
      
      // Midnight today for clean comparison
      const now = new Date();
      const tTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // Data containers for our layout slots
      let finalManualText = null; let finalManualBlink = false;
      let finalPreText    = null; let finalPreBlink    = false;
      let finalInfoText   = null;
      let activeUpdatesCount = 0;

      /* ── 1. CHECK PRE-UPDATE FOR JUMPING ── */
      if (data.pre_text?.trim()) {
        const preTs = parseDateTs(data.pre_date);
        if (!isNaN(preTs)) {
          if (preTs === tTs) {
            // Target date is today - jump to manual slot
            finalManualText = data.pre_text;
            finalManualBlink = (data.pre_blink === true || data.pre_blink === "true");
          } else if (preTs > tTs) {
            // Future date - stays in pre slot
            finalPreText = data.pre_text;
            finalPreBlink = (data.pre_blink === true || data.pre_blink === "true");
          }
        }
      }

      /* ── 2. CHECK MANUAL UPDATE (Overrides Jump) ── */
      if (data.manual_text?.trim()) {
        const manualTs = parseDateTs(data.manual_date);
        if (isNaN(manualTs) || manualTs >= tTs) {
          // Explicit manual update overrides any jumping pre-update
          finalManualText = data.manual_text;
          finalManualBlink = (data.manual_blink === true || data.manual_blink === "true");
        }
      }

      /* ── 3. CHECK INFO ── */
      if (data.info_text?.trim()) {
        finalInfoText = data.info_text;
      }

      /* ── 4. RENDER TO DOM ── */
      if (manualEl) {
        manualEl.classList.remove("blink");
        if (finalManualText) {
          manualEl.textContent = finalManualText;
          manualEl.style.color = "red";
          if (finalManualBlink) manualEl.classList.add("blink");
          activeUpdatesCount++;
        } else {
          manualEl.textContent = "No updates available at this time";
          manualEl.style.color = "";
        }
      }

      if (preEl) {
        preEl.classList.remove("blink");
        if (finalPreText) {
          preEl.textContent = finalPreText;
          preEl.style.color = "#f1c40f";
          if (finalPreBlink) preEl.classList.add("blink");
          activeUpdatesCount++;
        } else {
          preEl.textContent = "No updates scheduled";
          preEl.style.color = "";
        }
      }

      if (infoEl) {
        if (finalInfoText) {
          infoEl.textContent = finalInfoText;
          activeUpdatesCount++;
        } else {
          infoEl.textContent = "No general information";
        }
      }

      if (timeEl && data.last_updated) {
        timeEl.textContent = "Last updated: " + data.last_updated;
      }

      // Hide panel completely ONLY if there are exactly 0 active updates
      if (panel) {
        panel.style.display = (activeUpdatesCount > 0) ? "block" : "none";
      }

    } catch (error) {
      console.error("ELWOIC Database Fetch Error:", error);
      // Clean fallback text states if worker goes down or errors out
      if (manualEl) manualEl.textContent = "Unable to load critical alerts.";
      if (preEl) preEl.textContent = "Failed to sync updates.";
      if (infoEl) infoEl.textContent = "Service momentarily unreachable.";
    }
  }

  // Execute on page spin-up
  fetchLiveAlerts();
});
