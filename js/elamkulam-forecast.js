const REPORT_URL = "https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/";

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function splitLabel(t) {                       // "label: text" -> [label, text]
  const i = t.indexOf(": ");
  return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : ["", t];
}

function renderSection(s) {
  const title = `<span class="doc-h">${esc(s.title)}</span>`;
  const paras = s.lines.filter(l => !l.startsWith("• "));
  const bullets = s.lines.filter(l => l.startsWith("• ")).map(l => l.slice(2));

  // warning section -> bordered table, like the PDF
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

  // paragraph sections: heading runs on into the first paragraph, as in the PDF
  if (paras.length && !bullets.length) {
    return `<div class="doc-sec"><p>${title} ${esc(paras[0])}</p>
      ${paras.slice(1).map(p => `<p>${esc(p)}</p>`).join("")}</div>`;
  }

  // forecast / precaution lists
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
      <h2 class="doc-title">ദൈനിക കാലാവസ്ഥാവിവരണം</h2>
      <p class="doc-sub" style="text-align:center">എലങ്കുളം, മലപ്പുറം</p>
      <p class="doc-date" style="text-align:center">${esc(rep.date_line)}</p>
    </div>
    ${rep.sections.map(renderSection).join("")}
    <p class="doc-foot">${esc(footer)}</p>`;
}

fetch(REPORT_URL).then(r => r.json())
  .then(rep => { document.getElementById("report").innerHTML = renderReport(rep); })
  .catch(() => { document.getElementById("report").innerHTML = '<p class="doc-err">റിപ്പോർട്ട് ലഭ്യമല്ല. ദയവായി പിന്നീട് ശ്രമിക്കുക.</p>'; });
