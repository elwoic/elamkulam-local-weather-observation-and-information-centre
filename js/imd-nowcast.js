document.addEventListener("DOMContentLoaded", () => {
  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";
  const container = document.getElementById("nowcast-container");
  const ticker = document.getElementById("nowcast-ticker");

  // Official IMD Category Mapping
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
    // 16 is reserved for custom text, parsed separately below
    17: "Thunderstorms with Hail",
    18: "Severe Dust Storm (Wind > 61 kmph)",
    19: "High Lightning Probability (> 60%)"
  };

  async function fetchNowcast() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("Worker network response was not ok");
      
      const data = await response.json();

      // Check if there is an active nowcast
      if (data.nowcast) {
        let textElements = [];
        
        // 1. Parse standard numeric categories (cat1 to cat19, skipping 16)
        for (let i = 1; i <= 19; i++) {
          if (i === 16) continue;
          let catValue = data.nowcast[`cat${i}`];
          
          if (catValue && catValue !== "0" && catValue !== 0) {
             textElements.push(imdCategories[i].toUpperCase());
          }
        }
        
        // 2. Parse custom text fields (cat16 and message)
        if (data.nowcast.cat16 && data.nowcast.cat16 !== "0") {
            textElements.push(data.nowcast.cat16.toUpperCase());
        }
        if (data.nowcast.message && data.nowcast.message !== "0") {
            textElements.push(data.nowcast.message.toUpperCase());
        }
        
        let tickerText = textElements.join(" | ");
        if (!tickerText) tickerText = "ACTIVE NOWCAST ALERT ISSUED";

        // 3. Format validity time (e.g., "1900" -> "19:00")
        if (data.nowcast.toi && data.nowcast.vupto) {
            const formatTime = (t) => `${t.substring(0,2)}:${t.substring(2)}`;
            tickerText += ` (VALID: ${formatTime(data.nowcast.toi)} TO ${formatTime(data.nowcast.vupto)} IST)`;
        }

        // 4. ADD THE COLOR NAME TEXT 
        const alertColor = data.nowcast.color_name ? data.nowcast.color_name.toUpperCase() : "UNKNOWN";
        
        // Apply finalized text (Now includes the color explicitly!)
        ticker.innerText = `🇮🇳 IMD NOWCAST (${alertColor} ALERT): ${tickerText}`;
        
        // 5. Apply dynamic IMD background color
        container.className = "nowcast-marquee-container"; 
        container.classList.add(`nowcast-color-${data.nowcast.color_name}`);
        
        // Reveal the marquee
        container.style.display = "flex"; 
      } else {
        // If nowcast is null, hide the marquee completely
        container.style.display = "none";
      }
    } catch (error) {
      console.error("Error fetching nowcast:", error);
      container.style.display = "none";
    }
  }

  // Fetch immediately on page load
  fetchNowcast();
  
  // SWR Polling: safely check for new Nowcasts every 10 minutes from Cloudflare
  setInterval(fetchNowcast, 10 * 60 * 1000); 
});
