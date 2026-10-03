const REPORT_URL = "https://elwoic-forecast-report.bold-waterfall-0d01.workers.dev/";

// Absolute URLs, so the logos also load correctly.
const LOGO_LEFT  = new URL("ELWOIC.png", location.href).href;
const LOGO_RIGHT = new URL("Elamkulam Weather Logo Design.1.png", location.href).href;

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
);

function splitLabel(t) {
  const i = t.indexOf(": ");
  return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : ["", t];
}

function renderSection(s) {
  const title = `<span class="doc-h">${esc(s.title)}</span>`;
  const paras = s.lines.filter(l => !l.startsWith("• "));
  const bullets = s.lines.filter(l => l.startsWith("• "));

  if (s.key === "imd" && bullets.length) {
    const rows = bullets.map(b => {
      const [date, rest] = splitLabel(b);
      const [level, ...hz] = rest.split(" — ");

      return `
        <tr>
          <td>${esc(date)}</td>
          <td>${esc(level)}</td>
          <td>${esc(hz.join(" — ") || "-")}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="doc-sec">
        ${title}
        <div class="doc-table-wrap">
          <table>
            <thead>
              <tr>
                <th>തീയതി</th>
                <th>മുന്നറിയിപ്പ്</th>
                <th>അപകടസാധ്യത</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (paras.length && !bullets.length) {
    return `
      <div class="doc-sec">
        <p>${title} ${esc(paras[0])}</p>
        ${paras.slice(1).map(p => `<p>${esc(p)}</p>`).join("")}
      </div>
    `;
  }

  return `
    <div class="doc-sec">
      ${title}

      ${paras.map(p => `<p>${esc(p)}</p>`).join("")}

      <ul>
        ${bullets.map(b => {
          const [label, rest] = splitLabel(b);

          return label && s.key === "week"
            ? `<li><strong>${esc(label)}:</strong> ${esc(rest)}</li>`
            : `<li>${esc(b)}</li>`;
        }).join("")}
      </ul>
    </div>
  `;
}

function renderReport(rep) {
  const footer = rep.essay_ml.trim().split("\n").pop();

  return `
    <div class="doc-head">
      <img
        class="doc-logo"
        src="${LOGO_LEFT}"
        alt="ELWOIC"
        onerror="this.style.visibility='hidden'"
      >

      <div class="doc-titles">
        <h2 class="doc-title">ദൈനിക കാലാവസ്ഥാവിവരണം</h2>
        <p class="doc-sub">ഏലങ്കുളം, മലപ്പുറം</p>
      </div>

      <img
        class="doc-logo"
        src="${LOGO_RIGHT}"
        alt="ELWOIC"
        onerror="this.style.visibility='hidden'"
      >
    </div>

    <p class="doc-date">${esc(rep.date_line)}</p>

    ${rep.sections.map(renderSection).join("")}

    <p class="doc-foot">${esc(footer)}</p>
  `;
}

fetch(REPORT_URL)
  .then(r => r.json())
  .then(rep => {
    window.__reportDate = (rep.generated_at_ist || "").slice(0, 10);

    document.getElementById("report").innerHTML =
      renderReport(rep);
  })
  .catch(() => {
    document.getElementById("report").innerHTML =
      '<p class="doc-err">റിപ്പോർട്ട് ലഭ്യമല്ല. ദയവായി പിന്നീട് ശ്രമിക്കുക.</p>';
  });


/* ============================================================
   PRINT / SAVE AS PDF
   Native browser printing — same basic method as about.html
============================================================ */

async function printReport() {
  const report = document.getElementById("report");

  if (!report || !report.querySelector(".doc-head")) {
    alert("റിപ്പോർട്ട് ലോഡ് ചെയ്യുന്നു… അല്പം കാത്തിരിക്കുക.");
    return;
  }

  // Wait for report images to finish loading.
  const images = [...report.querySelectorAll("img")];

  await Promise.all(
    images.map(img => {
      if (img.complete) return Promise.resolve();

      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

  // Wait for web fonts, when supported.
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // Temporarily use the report title for the print/PDF interface.
  const oldTitle = document.title;

  const reportDate = window.__reportDate || "";
  const printTitle =
    `ELWOIC-Daily-Weather-Report-${reportDate}`;

  document.title = printTitle;

  // Restore the original title after printing.
  const restoreTitle = () => {
    document.title = oldTitle;
    window.removeEventListener("afterprint", restoreTitle);
  };

  window.addEventListener("afterprint", restoreTitle);

  // Native browser printing.
  window.print();
}
