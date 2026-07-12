// Point this directly to your new Unified Supabase Worker URL
const SUPABASE_WORKER_API = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/history";

async function loadHistory(days, btn) {
  document.querySelectorAll(".hist-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const loadEl = document.getElementById("hist-loading");
  const tableEl = document.getElementById("hist-table");
  const body = document.getElementById("hist-body");

  loadEl.style.display = "block";
  tableEl.style.display = "none";
  body.innerHTML = "";

  try {
    const res = await fetch(SUPABASE_WORKER_API);
    if (!res.ok) throw new Error("Failed to fetch weather history");
    const historyData = await res.json();

    if (!historyData || historyData.error || !Array.isArray(historyData)) {
      body.innerHTML = `<tr><td colspan="5">No history data available</td></tr>`;
      loadEl.style.display = "none";
      tableEl.style.display = "table";
      return;
    }

    // Slice the array to only display the number of requested days (e.g., 7 or 30)
    const displayData = historyData.slice(0, days);

    displayData.forEach(row => {
      // Format the ISO date (YYYY-MM-DD) into standard Indian Display format (e.g., 12 Jan)
      const dateObj = new Date(row.date);
      const formattedDate = dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

      // Helper function to safely format metrics to 1 decimal point
      const fmt = (val, fallback = "—") => (val != null && !isNaN(val)) ? Number(val).toFixed(1) : fallback;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formattedDate}</td>
        <td>
          <span style="color:#4a90e2">${fmt(row.daily_min_temp_c)}</span>
          /
          <span style="color:#e74c3c">${fmt(row.daily_max_temp_c)}</span>
          °C
        </td>
        <td>${fmt(row.daily_max_gust_kmh, "0.0")} km/h</td>
        <td>
          ${fmt(row.daily_min_press_hpa)}
          /
          ${fmt(row.daily_max_press_hpa)}
          hPa
        </td>
        <td>${fmt(row.daily_rain_mm, "0.0")} mm</td>
      `;
      body.appendChild(tr);
    });

  } catch (e) {
    console.error("Supabase Metrics API failed:", e);
    body.innerHTML = `<tr><td colspan="5">Error loading weather records.</td></tr>`;
  }

  loadEl.style.display = "none";
  tableEl.style.display = "table";
}

// INIT - Load the initial batch (e.g., 7 days)
loadHistory(7, document.querySelector(".hist-btn.active"));
