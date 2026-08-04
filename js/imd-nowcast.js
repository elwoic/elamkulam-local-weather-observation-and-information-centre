document.addEventListener("DOMContentLoaded", () => {
  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";
  const container = document.getElementById("nowcast-container");
  const ticker = document.getElementById("nowcast-ticker");

  const NORMAL_POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const FAST_POLL_INTERVAL = 10 * 1000;         // 10 seconds (for expired state)
  
  let pollTimer = null;

  const imdCategories = {
    1: "No Severe Weather",
    2: "Light Rain (< 5 mm/hr)",
    3: "Light Snow (< 5 cm/hr)",
    4: "Light Thunderstorms (Wind < 40 kmph)",
    5: "Slight Dust Storm",
    6: "Low Lightning Probability (< 30%)",
    7: "Moderate Rain (5-15 mm/hr)",
    8: "Moderate Snow (5-15 cm/hr)",
    9: "Moderate Thunderstorms (Wind 41-61 kmph)",
    10: "Moderate Dust Storm",
    11: "Moderate Lightning Probability (30-60%)",
    12: "Heavy Rain (> 15 mm/hr)",
    13: "Heavy Snow (> 15 cm/hr)",
    14: "Severe Thunderstorms (Wind 62-87 kmph)",
    15: "Very Severe Thunderstorms (Wind > 87 kmph)",
    17: "Thunderstorms with Hail",
    18: "Severe Dust Storm (Wind > 61 kmph)",
    19: "High Lightning Probability (> 60%)"
  };

  // Helper to check if current IST time is past vupto HHMM
  function isNowcastExpired(nowcast, validUntilMs) {
    if (validUntilMs && Date.now() > validUntilMs) return true;
    
    if (nowcast && nowcast.vupto && nowcast.vupto.length >= 4) {
      const now = new Date();
      // IST offset conversion
      const istNow = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
      const currentHHMM = (istNow.getHours() * 100) + istNow.getMinutes();
      const vuptoHHMM = parseInt(nowcast.vupto, 10);

      // If validity hour isn't past midnight span, simple check
      if (nowcast.toi && parseInt(nowcast.toi, 10) <= vuptoHHMM) {
        if (currentHHMM > vuptoHHMM) return true;
      }
    }
    return false;
  }

  function scheduleNextFetch(ms) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(fetchNowcast, ms);
  }

  async function fetchNowcast() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("Worker network response was not ok");
      
      const data = await response.json();

      if (data.nowcast) {
        let textElements = [];
        
        // 1. Parse standard numeric categories
        for (let i = 1; i <= 19; i++) {
          if (i === 16) continue;
          let catValue = data.nowcast[`cat${i}`];
          if (catValue && catValue !== "0" && catValue !== 0) {
            textElements.push(imdCategories[i].toUpperCase());
          }
        }
        
        // 2. Parse custom text fields
        if (data.nowcast.cat16 && data.nowcast.cat16 !== "0") {
          textElements.push(data.nowcast.cat16.toUpperCase());
        }
        if (data.nowcast.message && data.nowcast.message !== "0") {
          textElements.push(data.nowcast.message.toUpperCase());
        }
        
        let tickerText = textElements.join(" | ");
        if (!tickerText) tickerText = "ACTIVE NOWCAST ALERT ISSUED";

        // 3. Format validity time
        if (data.nowcast.toi && data.nowcast.vupto) {
          const formatTime = (t) => `${t.substring(0,2)}:${t.substring(2)}`;
          tickerText += ` (VALID: ${formatTime(data.nowcast.toi)} TO ${formatTime(data.nowcast.vupto)} IST)`;
        }

        const alertColor = data.nowcast.color_name ? data.nowcast.color_name.toUpperCase() : "UNKNOWN";
        
        // 4. Check if validity expired
        const expired = data.is_expired || isNowcastExpired(data.nowcast, data.valid_until_ms);

        if (expired || data.cache_status === "EXPIRED_STALE_UPDATING") {
          // Display old data with "UPDATING..." notice
          ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT) [EXPIRED - UPDATING...]: ${tickerText}`;
          
          // Fast-poll every 10 seconds until IMD Bridge updates KV
          scheduleNextFetch(FAST_POLL_INTERVAL);
        } else {
          // Normal active alert display
          ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT): ${tickerText}`;
          
          // Revert to standard 10-minute polling
          scheduleNextFetch(NORMAL_POLL_INTERVAL);
        }
        
        // 5. Apply styling
        container.className = "nowcast-marquee-container"; 
        container.classList.add(`nowcast-color-${data.nowcast.color_name}`);
        container.style.display = "flex"; 
      } else {
        // No nowcast active, hide marquee & schedule normal polling
        container.style.display = "none";
        scheduleNextFetch(NORMAL_POLL_INTERVAL);
      }
    } catch (error) {
      console.error("Error fetching nowcast:", error);
      container.style.display = "none";
      scheduleNextFetch(NORMAL_POLL_INTERVAL);
    }
  }

  // Initial fetch on page load
  fetchNowcast();
});
