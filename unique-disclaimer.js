document.addEventListener("DOMContentLoaded", () => {
  const disclaimer = document.getElementById("unique-disclaimer");
  const toggleBtn = disclaimer.querySelector(".unique-disclaimer-toggle");

  // 1️⃣ Always start collapsed
  disclaimer.classList.add("collapsed");

  // 2️⃣ Toggle on arrow click
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent accidental bubbling
    disclaimer.classList.toggle("collapsed");
  });

  // Optional: allow clicking the header to toggle
  disclaimer.querySelector(".unique-disclaimer-header")
    .addEventListener("click", () => {
      disclaimer.classList.toggle("collapsed");
    });
});
