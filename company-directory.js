(() => {
  "use strict";
  const search = document.getElementById("companySearch");
  const filter = document.getElementById("companyCategory");
  const grid = document.getElementById("companyDirectoryGrid");
  const count = document.getElementById("companyResultCount");
  const empty = document.getElementById("companyNoResults");
  if (!search || !filter || !grid || !count || !empty) return;

  const cards = [...grid.querySelectorAll(".directory-card")];
  const normalize = value => String(value || "").trim().toLocaleLowerCase();

  function render() {
    const term = normalize(search.value);
    const category = filter.value;
    let visible = 0;

    for (const card of cards) {
      const matchesTerm = !term || normalize(card.dataset.search).includes(term);
      const matchesCategory = category === "all" || card.dataset.category === category;
      const show = matchesTerm && matchesCategory;
      card.hidden = !show;
      if (show) visible += 1;
    }

    count.textContent = visible + (visible === 1 ? " company" : " companies");
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  render();
})();
