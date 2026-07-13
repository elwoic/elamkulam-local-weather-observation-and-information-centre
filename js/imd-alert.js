(function () {

  const WORKER_URL = "https://imdalert.aswanthkrishnak822.workers.dev";

  // Official IMD Warning Code mapping (api_reference.html#api-6)
  const WARNING_MAP = {
    "1":  "No Warning",
    "2":  "Heavy Rain",
    "3":  "Heavy Snow",
    "4":  "Thunderstorm & Lightning",
    "5":  "Hailstorm",
    "6":  "Dust Storm",
    "7":  "Dust Raising Winds",
    "8":  "Strong Surface Winds",
    "9":  "Heat Wave",
    "10": "Hot Day",
    "11": "Warm Night",
    "12": "Cold Wave",
    "13": "Cold Day",
    "14": "Ground Frost",
    "15": "Fog",
    "16": "Very Heavy Rain",
    "17": "Extremely Heavy Rain"
  };

  // Official IMD Color Code mapping (corrected 2026-06-05)
  const COLOR_META = {
    "1": { name: "Red alert — Take action",    hex: "#ef4444", dot: "dot-5" },
    "2": { name: "Orange alert — Be prepared", hex: "#f97316", dot: "dot-4" },
    "3": { name: "Yellow alert — Be aware",    hex: "#eab308", dot: "dot-3" },
    "4": { name: "Green — No warning",         hex: "#22c55e", dot: "dot-1" }
  };

  function decodeWarnings(codeStr) {
    if (!codeStr || codeStr === "0") return ["No specific warning"];
    return codeStr.split(",").map(function (c) {
      return WARNING_MAP[c.trim()] || ("Weather event " + c.trim());
    });
  }

  function getISTDate() {
    var s = new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit"
    });
    return new Date(s);
  }

  function offsetDate(baseDate, days) {
    var d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  var imdData = null;
  var refreshScheduled = false;

  function renderDays(todayDiff) {
    var container = document.getElementById("imdDays");
    var html = "";
    var base = new Date(imdData.Date);
    base.setHours(0, 0, 0, 0);

    for (var i = 0; i < 5; i++) {
      var colorId = imdData["Day" + (i + 1) + "_Color"] || "4";
      var meta = COLOR_META[colorId] || { dot: "dot-x", hex: "#888" };
      var isToday = i === todayDiff;
      var isActive = isToday ? "active" : "";
      var labelClass = isToday ? "imd-day-label today" : "imd-day-label";
      var labelText = isToday ? "Today" : offsetDate(base, i);

      html += '<button class="imd-day-btn ' + isActive + '"'
            + ' role="tab" aria-selected="' + isToday + '"'
            + ' data-day="' + i + '"'
            + ' onclick="window._imdSelect(' + i + ')">'
            + '<span class="' + labelClass + '">' + labelText + '</span>'
            + '<div class="imd-color-dot ' + meta.dot + '"></div>'
            + '<span class="imd-day-date">' + offsetDate(base, i) + '</span>'
            + '</button>';
    }

    container.innerHTML = html;
    renderDetail(todayDiff);
  }

  window._imdSelect = function (i) {
    document.querySelectorAll(".imd-day-btn").forEach(function (btn, idx) {
      btn.classList.toggle("active", idx === i);
      btn.setAttribute("aria-selected", idx === i);
    });
    renderDetail(i);
  };

  function renderDetail(i) {
    var detail = document.getElementById("imdDetail");
    var colorId = imdData["Day" + (i + 1) + "_Color"] || "4";
    var meta = COLOR_META[colorId] || { name: "Unknown", hex: "#888", dot: "dot-x" };
    var warnings = decodeWarnings(imdData["Day_" + (i + 1)]);
    var base = new Date(imdData.Date);
    base.setHours(0, 0, 0, 0);
    var dateLabel = offsetDate(base, i);

    var tags = warnings.map(function (w) {
      return '<span class="imd-warning-tag">' + w + '</span>';
    }).join("");

    detail.innerHTML =
      '<div class="imd-detail-top">'
      + '<div class="imd-alert-dot" style="background:' + meta.hex + ';"></div>'
      + '<span class="imd-alert-name">' + meta.name + '</span>'
      + '<span class="imd-alert-date">' + dateLabel + '</span>'
      + '</div>'
      + '<div class="imd-warning-tags">' + tags + '</div>';
  }

  async function loadIMD() {
    try {
      var res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error("fetch failed");
      imdData = await res.json();

      // Updated at
      var upEl = document.getElementById("imdUpdatedAt");
      upEl.textContent = "System updated: " + (imdData.updated_at || "N/A");

      // Diff
      var todayIST = getISTDate();
      var base = new Date(imdData.Date);
      base.setHours(0, 0, 0, 0);
      var diff = Math.round((todayIST - base) / 86400000);
      if (diff < 0) diff = 0;
      if (diff > 4) diff = 4;

      renderDays(diff);

      // Status bar
      var statusEl = document.getElementById("imdStatusBar");
      var parts = [];
      if (imdData.stale)      parts.push("⚠ Showing previous bulletin");
      if (imdData.updating)   parts.push("🔄 Updating latest data...");
      if (imdData.error_mode) parts.push("⚠ Using backup data");
      if (imdData.is_cached)  parts.push("Served from cache · " + (imdData.fetch_period || ""));
      if (parts.length) {
        statusEl.style.display = "block";
        statusEl.textContent = parts.join("  ·  ");
      }

      // Auto-refresh if updating in background
      if (imdData.updating && !refreshScheduled) {
        refreshScheduled = true;
        setTimeout(function () {
          refreshScheduled = false;
          loadIMD();
        }, 30000);
      }

    } catch (e) {
      document.getElementById("imdDays").innerHTML =
        '<div class="imd-loading-row">⚠ Could not load IMD data. Please check official IMD channels.</div>';
      document.getElementById("imdDetail").innerHTML = "";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadIMD);
  } else {
    loadIMD();
  }

})();
