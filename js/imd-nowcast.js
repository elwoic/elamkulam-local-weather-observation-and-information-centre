document.addEventListener("DOMContentLoaded", () => {
  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";
  const container = document.getElementById("nowcast-container");
  const ticker = document.getElementById("nowcast-ticker");

  async function fetchNowcast() {
    try {
      const response = await fetch(WORKER_URL);
      if (!response.ok) throw new Error("Worker network response was not ok");
      
      const data = await response.json();

      // Check if there is an active nowcast
      if (data.nowcast) {
        let textElements = [];
        
        // Grab the relevant text fields based on what IMD sent
        if (data.nowcast.message) textElements.push(data.nowcast.message);
        if (data.nowcast.cat16) textElements.push(data.nowcast.cat16);
        
        let tickerText = textElements.join(" | ");
        if (!tickerText) tickerText = "Active Nowcast Alert Issued by IMD.";

        // Format validity time (e.g., "1900" -> "19:00")
        if (data.nowcast.toi && data.nowcast.vupto) {
            const formatTime = (t) => `${t.substring(0,2)}:${t.substring(2)}`;
            tickerText += ` (Valid: ${formatTime(data.nowcast.toi)} to ${formatTime(data.nowcast.vupto)} IST)`;
        }

        // Apply text
        ticker.innerText = `🚨 IMD NOWCAST: ${tickerText}`;
        
        // Reset container classes, then apply the IMD color code class
        container.className = "nowcast-marquee-container"; 
        container.classList.add(`nowcast-color-${data.nowcast.color_name}`);
        
        // Make the marquee visible
        container.style.display = "flex"; 
      } else {
        // No active nowcast -> Hide the marquee completely
        container.style.display = "none";
      }
    } catch (error) {
      console.error("Error fetching nowcast:", error);
      // Failsafe: hide on error so UI stays clean
      container.style.display = "none";
    }
  }

  // Fetch immediately on page load
  fetchNowcast();
  
  // Since you are using Stale-While-Revalidate (SWR) on Cloudflare, 
  // polling every 10 minutes is completely safe and won't consume Render API limits.
  setInterval(fetchNowcast, 10 * 60 * 1000); 
});
