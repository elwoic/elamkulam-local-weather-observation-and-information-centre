(function () {

  const API_URL     = "https://elwoic-petrichor-dx3n8-stream.bold-waterfall-0d01.workers.dev/live";
  const OUTLOOK_URL = "https://elwoic-atmosphere-controller.elwoicelamkulam.workers.dev/";

  /* ── Beaufort scale (client-side) ── */
  function beaufort(kmh) {
    const scale = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    const desc  = ["Calm","Light air","Light breeze","Gentle breeze","Moderate breeze",
                   "Fresh breeze","Strong breeze","Near gale","Gale","Strong gale","Storm","Violent storm","Hurricane"];
    const b = scale.findIndex(v => kmh < v);
    return { force: b === -1 ? 12 : b, description: desc[b === -1 ? 12 : b] };
  }

  /* ── Load station + wind (unified worker) ── */
  async function loadStation() {
    try {
      const res     = await fetch(API_URL, { cache: "no-store" });
      const payload = await res.json();

      const ld  = payload.live_data || {};
      const tmp = ld.temperature   || {};
      const hum = ld.humidity      || {};
      const wnd = ld.wind          || {};
      const rn  = ld.rain          || {};

      /* ── Station fields ── */
      const temp  = tmp.outdoor            ?? "--";
      const feels = tmp.feels_like_outdoor ?? "--";
      const dew   = tmp.dew_point_outdoor  ?? "--";
      const h     = hum.outdoor            ?? "--";
      const solar = ld.solar_wm2           ?? "--";
      const rain  = rn.daily_mm            ?? "--";

      document.getElementById("cw-temp").textContent     = temp  !== "--" ? Number(temp).toFixed(1)  : "--";
      document.getElementById("cw-feels").textContent    = feels !== "--" ? Number(feels).toFixed(1) + "°C" : "--";
      document.getElementById("cw-humidity").textContent = h;
      document.getElementById("cw-solar").textContent    = solar !== "--" ? Math.round(solar) : "--";
      document.getElementById("cw-dew").textContent      = dew   !== "--" ? Number(dew).toFixed(1)   : "--";
      document.getElementById("cw-rain").textContent     = rain  !== "--" ? Number(rain).toFixed(1)  : "--";

      /* ── Timestamps from Supabase updated_at ── */
      const ts = payload.updated_at
        ? new Date(payload.updated_at).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
          })
        : "--";
      document.getElementById("cw-updated").textContent        = "Updated " + ts;
      document.getElementById("cw-updated-footer").textContent = "Updated " + ts;

      /* ── Wind fields ── */
      const windSpeed  = wnd.speed_kmh             ?? 0;
      const windGust   = wnd.gust_kmh              ?? 0;
      const windDirDeg = wnd.direction_degrees     ?? 0;
      const windComp   = wnd.direction_compass     ?? "--";
      const avg10Deg   = wnd.avg_10min_dir_deg     ?? "--";
      const avg10Comp  = wnd.avg_10min_dir_compass ?? "--";
      const dayMaxGust = payload.daily_max_gust_kmh ?? "--";
      const bft        = beaufort(windSpeed);

      document.getElementById("w-speed").textContent     = Number(windSpeed).toFixed(1);
      document.getElementById("w-gust").textContent      = Number(windGust).toFixed(1);
      document.getElementById("w-dir").textContent       = windComp + " " + windDirDeg + "°";
      document.getElementById("w-avg-dir").textContent   = avg10Comp + " " + avg10Deg + "°";
      document.getElementById("w-beaufort").textContent  = "Bf " + bft.force + " · " + bft.description;
      document.getElementById("w-daily-max").textContent = dayMaxGust !== "--" ? Number(dayMaxGust).toFixed(1) : "--";

    } catch (e) {
      document.getElementById("cw-condition").textContent = "Data unavailable";
      document.getElementById("cw-updated").textContent   = "Update error";
      document.getElementById("w-beaufort").textContent   = "Wind data unavailable";
    }
  }

  /* ── Load atmospheric outlook (unchanged) ── */
  async function loadOutlook() {
    try {
      const res  = await fetch(OUTLOOK_URL);
      const data = await res.json();
      const fc   = data.forecast;
      const snap = fc.snapshot;

      const condEl = document.getElementById("cw-condition");
      if (fc.current_condition) {
        const words = fc.current_condition.split(" ");
        condEl.textContent = words.slice(0, 10).join(" ") + (words.length > 10 ? "…" : "");
      }

      document.getElementById("oc-current").textContent = fc.current_condition || "—";
      document.getElementById("oc-3h").textContent      = fc.outlook_1_3h     || "—";
      document.getElementById("oc-6h").textContent      = fc.outlook_3_6h     || "—";

      const conf   = data.controller.winnerConfidence || 0;
      const confEl = document.getElementById("oc-conf-now");
      const dotEl  = document.getElementById("oc-dot-now");
      const textEl = document.getElementById("oc-conf-now-text");
      if (conf) {
        confEl.style.display = "inline-flex";
        textEl.textContent   = conf + "% confidence · " + (data.controller.selectedFamily || "").replace(/_/g, " ");
        dotEl.className      = "conf-dot" + (conf >= 80 ? "" : conf >= 60 ? " mod" : " low");
      }

      if (snap && snap.feels) {
        document.getElementById("cw-feels").textContent = snap.feels.toFixed(1) + "°C";
      }

    } catch (e) {
      document.getElementById("oc-current").textContent = "Outlook unavailable";
      document.getElementById("oc-3h").textContent      = "—";
      document.getElementById("oc-6h").textContent      = "—";
    }
  }

  /* ── Boot ── */
  async function refresh() {
    await Promise.all([loadStation(), loadOutlook()]);
  }

  refresh();
  setInterval(refresh, 600_000); /* 10-minute refresh */

})();
