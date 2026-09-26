/* Progressive enhancement: the complete manual also works without JavaScript. */
const english = document.documentElement.lang === "en";
const chapters = [...document.querySelectorAll(".chapter")];
const nav = document.querySelector("#toc");
const search = document.querySelector("#search");
const results = document.querySelector("#results");
const normalize = (text) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const index = chapters.map((section) => ({
  section,
  text: normalize(section.textContent),
}));
function filterGuide() {
  const words = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
  let count = 0;
  index.forEach(({ section, text }) => {
    const visible = words.every((word) => text.includes(word));
    section.hidden = !visible;
    if (visible) count++;
    const link = nav.querySelector(`a[href="#${section.id}"]`);
    if (link) link.hidden = !visible;
  });
  results.textContent = words.length
    ? english
      ? `${count} chapter${count !== 1 ? "s" : ""} found. Ctrl+F searches the text.`
      : `${count} chapitre${count > 1 ? "s" : ""} trouvé${count > 1 ? "s" : ""}. Ctrl+F cherche dans le texte.`
    : "";
}
search.addEventListener("input", filterGuide);
search.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    search.value = "";
    filterGuide();
  }
});
document.querySelector("#clear-search").addEventListener("click", () => {
  search.value = "";
  filterGuide();
  search.focus();
});
document
  .querySelector("#print")
  .addEventListener("click", () => window.print());
const menu = document.querySelector(".mobile-menu");
menu.addEventListener("click", () => {
  const open = document.querySelector(".sidebar").classList.toggle("open");
  menu.setAttribute("aria-expanded", String(open));
});
function revealHash() {
  const target = document.getElementById(
    decodeURIComponent(location.hash.slice(1)),
  );
  if (target?.closest(".chapter")?.hidden) {
    search.value = "";
    filterGuide();
    target.scrollIntoView();
  }
}
window.addEventListener("hashchange", revealHash);
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (a) {
    document.querySelector(".sidebar").classList.remove("open");
    menu.setAttribute("aria-expanded", "false");
    const section = document
      .getElementById(a.hash.slice(1))
      ?.closest(".chapter");
    if (section?.hidden) {
      search.value = "";
      filterGuide();
    }
  }
});
// Observe all chapters with a single observer.
const tracker =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              nav.querySelectorAll("a").forEach((a) => {
                const active = a.hash === `#${entry.target.id}`;
                a.classList.toggle("active", active);
                if (active) a.setAttribute("aria-current", "location");
                else a.removeAttribute("aria-current");
              });
            }
        },
        { rootMargin: "-5% 0px -65% 0px" },
      )
    : null;
chapters.forEach((section) => tracker?.observe(section));
const lightbox = document.querySelector("#lightbox");
document.querySelectorAll("a[data-zoom]").forEach((a) =>
  a.addEventListener("click", (e) => {
    if (!lightbox.showModal) return;
    e.preventDefault();
    const img = a.querySelector("img");
    lightbox.querySelector("img").src = a.href;
    lightbox.querySelector("img").alt = img.alt;
    lightbox.querySelector("img").style.width =
      `${2 * (Number(img.getAttribute("width")) || img.naturalWidth)}px`;
    lightbox.querySelector("p").textContent =
      a.dataset.caption ||
      a.closest("figure")?.querySelector("figcaption")?.textContent ||
      img.alt;
    lightbox.showModal();
  }),
);
lightbox
  .querySelector("button")
  .addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.close();
});
revealHash();

// Keep the current chapter when switching between the two static editions.
function updateLanguageLinks() {
  document.querySelectorAll("a[data-language]").forEach((link) => {
    link.hash = location.hash;
  });
}
window.addEventListener("hashchange", updateLanguageLinks);
updateLanguageLinks();
