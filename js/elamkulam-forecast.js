const REPORT_URL = "https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/";

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const ICONS = { current:"🌡️", summary:"📋", week:"📅", today:"🕒", imd:"⚠️", impact:"⚡", actions:"🛡️" };
const colorClass = t => t.includes("ചുവപ്പ്") ? "red" : t.includes("ഓറഞ്ച്") ? "orange" : t.includes("മഞ്ഞ") ? "yellow" : "green";

function renderBullet(sec, text) {
  const i = text.indexOf(": ");
  if ((sec.key === "week" || sec.key === "imd") && i > 0) {
    const label = text.slice(0, i), rest = text.slice(i + 2);
    if (sec.key === "imd") {
      const [lvl, ...hz] = rest.split(" — ");
      return `<li class="rp-row"><span class="rp-label">${esc(label)}</span>
        <span class="rp-chip rp-${colorClass(lvl)}">${esc(lvl)}</span>
        ${hz.length ? `<span class="rp-hz">${esc(hz.join(" — "))}</span>` : ""}</li>`;
    }
    return `<li class="rp-row"><span class="rp-label">${esc(label)}</span><span>${esc(rest)}</span></li>`;
  }
  return `<li>${esc(text)}</li>`;
}

function renderReport(rep) {
  const footer = rep.essay_ml.trim().split("\n").pop();
  const body = rep.sections.map(s => {
    const paras   = s.lines.filter(l => !l.startsWith("• "));
    const bullets = s.lines.filter(l => l.startsWith("• ")).map(l => l.slice(2));
    return `
      <section class="rp-sec rp-${esc(s.key)}">
        <h3><span>${ICONS[s.key] || "•"}</span>${esc(s.title.replace(/:$/, ""))}</h3>
        ${paras.map(p => `<p>${esc(p)}</p>`).join("")}
        ${bullets.length ? `<ul class="rp-list">${bullets.map(b => renderBullet(s, b)).join("")}</ul>` : ""}
      </section>`;
  }).join("");

  return `
    <header class="rp-head">
      <div>
        <div class="rp-title">ദൈനിക കാലാവസ്ഥാവിവരണം</div>
        <div class="rp-place">എലങ്കുളം, മലപ്പുറം</div>
      </div>
      <div class="rp-date">${rep.date_line.split(" | ").map(d => `<span>${esc(d)}</span>`).join("")}</div>
    </header>
    <div class="rp-body">${body}</div>
    <p class="rp-foot">${esc(footer)}</p>`;
}

fetch(REPORT_URL).then(r => r.json())
  .then(rep => { document.getElementById("report").innerHTML = renderReport(rep); })
  .catch(() => { document.getElementById("report").innerHTML = '<p class="rp-err">റിപ്പോർട്ട് ലഭ്യമല്ല. ദയവായി പിന്നീട് ശ്രമിക്കുക.</p>'; });
