(() => {
  "use strict";
  const search = document.getElementById("companySearch");
  const country = document.getElementById("companyCountry");
  const grid = document.getElementById("companyDirectoryGrid");
  const count = document.getElementById("companyResultCount");
  const empty = document.getElementById("companyNoResults");
  if (!search || !country || !grid || !count || !empty) return;

  const cards = [...grid.querySelectorAll(".directory-card")];
  const normalize = value => String(value || "").trim().toLocaleLowerCase();

  function render() {
    const term = normalize(search.value);
    const selectedCountry = country.value;
    let visible = 0;

    for (const card of cards) {
      const matchesTerm = !term || normalize(card.dataset.search).includes(term);
      const markets = (card.dataset.countryCodes || "").split(/\\s+/).filter(Boolean);
      const matchesCountry = selectedCountry === "all" || markets.includes(selectedCountry);
      const show = matchesTerm && matchesCountry;
      card.hidden = !show;
      if (show) visible += 1;
    }

    count.textContent = visible.toLocaleString() + (visible === 1 ? " carrier profile" : " carrier profiles");
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", render);
  country.addEventListener("change", render);
  render();
})();
