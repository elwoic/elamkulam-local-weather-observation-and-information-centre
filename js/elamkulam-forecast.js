const REPORT_URL = "https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/";
// absolute URLs, so the logos also load inside the print document
const LOGO_LEFT  = new URL("ELWOIC.png", location.href).href;
const LOGO_RIGHT = new URL("Elamkulam Weather Logo Design.1.png", location.href).href;

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function splitLabel(t) {
  const i = t.indexOf(": ");
  return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : ["", t];
}

function renderSection(s) {
  const title = `<span class="doc-h">${esc(s.title)}</span>`;
  const paras = s.lines.filter(l => !l.startsWith("• "));
  const bullets = s.lines.filter(l => l.startsWith("• ")).map(l => l.slice(2));

  if (s.key === "imd" && bullets.length) {
    const rows = bullets.map(b => {
      const [date, rest] = splitLabel(b);
      const [level, ...hz] = rest.split(" — ");
      return `<tr><td>${esc(date)}</td><td>${esc(level)}</td><td>${esc(hz.join(" — ") || "-")}</td></tr>`;
    }).join("");
    return `<div class="doc-sec">${title}
      <div class="doc-table-wrap"><table>
        <thead><tr><th>തീയതി</th><th>മുന്നറിയിപ്പ്</th><th>അപകടസാധ്യത</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
  }
  if (paras.length && !bullets.length) {
    return `<div class="doc-sec"><p>${title} ${esc(paras[0])}</p>
      ${paras.slice(1).map(p => `<p>${esc(p)}</p>`).join("")}</div>`;
  }
  return `<div class="doc-sec">${title}
    ${paras.map(p => `<p>${esc(p)}</p>`).join("")}
    <ul>${bullets.map(b => {
      const [label, rest] = splitLabel(b);
      return label && s.key === "week"
        ? `<li><strong>${esc(label)}:</strong> ${esc(rest)}</li>`
        : `<li>${esc(b)}</li>`;
    }).join("")}</ul></div>`;
}

function renderReport(rep) {
  const footer = rep.essay_ml.trim().split("\n").pop();
  return `
    <div class="doc-head">
      <img class="doc-logo" src="${LOGO_LEFT}" alt="ELWOIC" onerror="this.style.visibility='hidden'">
      <div class="doc-titles">
        <h2 class="doc-title">ദൈനിക കാലാവസ്ഥാവിവരണം</h2>
        <p class="doc-sub">എലങ്കുളം, മലപ്പുറം</p>
      </div>
      <img class="doc-logo" src="${LOGO_RIGHT}" alt="ELWOIC" onerror="this.style.visibility='hidden'">
    </div>
    <p class="doc-date">${esc(rep.date_line)}</p>
    ${rep.sections.map(renderSection).join("")}
    <p class="doc-foot">${esc(footer)}</p>`;
}

fetch(REPORT_URL).then(r => r.json())
  .then(rep => {
    window.__reportDate = (rep.generated_at_ist || "").slice(0, 10);
    document.getElementById("report").innerHTML = renderReport(rep);
  })
  .catch(() => { document.getElementById("report").innerHTML = '<p class="doc-err">റിപ്പോർട്ട് ലഭ്യമല്ല. ദയവായി പിന്നീട് ശ്രമിക്കുക.</p>'; });

/* ---------- PRINT / SAVE AS PDF ---------- */
const PRINT_CSS = `
  @page { size: A4; margin: 14mm 14mm 16mm; }
  html, body { background:#fff !important; margin:0; padding:0; overflow:visible !important; }
  body::before { display:none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #report { padding:0 !important; font-size:11.5pt; line-height:1.7; }
  #report .doc-logo { width:22mm; height:22mm; }
  #report .doc-head, #report .doc-date { break-after:avoid; }
  #report .doc-h { break-after:avoid; }
  #report li, #report tr { break-inside:avoid; }
  #report .doc-foot { break-inside:avoid; }
`;

async function printReport() {
  const src = document.getElementById("report");
  if (!src || !src.querySelector(".doc-head")) { alert("റിപ്പോർട്ട് ലോഡ് ചെയ്യുന്നു… അല്പം കാത്തിരിക്കുക."); return; }

  const title  = `ELWOIC-Daily-Weather-Report-${window.__reportDate || ""}`;
  const styles = [...document.querySelectorAll("style, link[rel=stylesheet]")].map(n => n.outerHTML).join("");

  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!DOCTYPE html><html lang="ml"><head><meta charset="utf-8"><title>${title}</title>
    ${styles}<style>${PRINT_CSS}</style></head><body><div id="report">${src.innerHTML}</div></body></html>`);
  d.close();

  const imgs = [...d.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }));
  await Promise.all([d.fonts ? d.fonts.ready : null, ...imgs, new Promise(r => setTimeout(r, 600))]);

  const oldTitle = document.title;
  let parentOld = null;
  document.title = title;
  try { parentOld = window.parent.document.title; window.parent.document.title = title; } catch (e) {}

  f.contentWindow.addEventListener("afterprint", () => {
    document.title = oldTitle;
    try { if (parentOld !== null) window.parent.document.title = parentOld; } catch (e) {}
    setTimeout(() => f.remove(), 500);
  });
  f.contentWindow.focus();
  f.contentWindow.print();
}
