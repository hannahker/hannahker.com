const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
const panelLabel = document.getElementById("panel-label");
const sectionLinks = document.querySelectorAll(".masthead [data-route]");

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const views = {
  about: () => ({
    label: "01. About",
    html: `<article class="prose">${CONTENT.about}</article>`,
  }),
  works: () => ({
    label: "02. Selected Works",
    html: `<ol class="works">${CONTENT.works.map((w) => `
      <li><a href="#works/${w.slug}">
        <span class="works-title">${escapeHtml(w.title)}</span>
        <span class="works-medium">${w.medium}</span>
      </a></li>`).join("")}
    </ol>`,
  }),
  work: (slug) => {
    const w = CONTENT.works.find((x) => x.slug === slug);
    if (!w) return null;
    return {
      label: `02. Selected Works &nbsp;/&nbsp; <a href="#works">all works</a>`,
      html: `<article class="prose work">
        <h2>${escapeHtml(w.title)}</h2>
        <figure class="hero"><img src="${w.image}" width="${w.width}" height="${w.height}" alt="${escapeHtml(w.alt)}"></figure>
        ${w.html}
      </article>`,
    };
  },
};

function route() {
  const [section, slug] = location.hash.slice(1).split("/");
  const view = section === "about" ? views.about() : section === "works" ? (slug ? views.work(slug) : views.works()) : null;

  sectionLinks.forEach((a) => a.toggleAttribute("aria-current", Boolean(view) && a.dataset.route === section));
  requestFrame();
  if (!view) {
    panel.hidden = true;
    document.body.classList.remove("panel-open");
    return;
  }
  const home = constrain(homeView());
  glideTo(home);
  document.documentElement.style.setProperty("--rail", `${Math.round(clamp(labelsRightEdge(home) + 32, 240, innerWidth * 0.6))}px`);
  panelLabel.innerHTML = view.label;
  panelBody.innerHTML = view.html;
  panel.hidden = false;
  document.body.classList.add("panel-open");
  panelBody.scrollTop = 0;
  panelBody.focus({ preventScroll: true });
}

function closePanel() {
  if (panel.hidden) return;
  history.pushState(null, "", location.pathname + location.search);
  route();
}

panel.querySelector(".panel-close").addEventListener("click", closePanel);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel();
});

window.addEventListener("hashchange", route);
route();
