const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
const panelLabel = document.getElementById("panel-label");
const sectionLinks = document.querySelectorAll(".masthead [data-route]");

const SITE_TITLE = document.title;
let returnFocus = null;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CATEGORIES = { maps: "Maps", projects: "Special Projects" };

const views = {
  about: () => ({
    label: "About",
    html: `<article class="prose"><h2 class="sr-only">About</h2>${CONTENT.about}</article>`,
  }),
  maps: () => ({
    label: "Maps",
    html: `<h2 class="sr-only">Maps</h2><ul class="map-grid">${CONTENT.maps.map((m) => `
      <li><a href="#maps/${m.slug}">
        <img src="${m.thumb}" alt="" style="object-position: ${m.focus}" loading="lazy">
        <span>${escapeHtml(m.title)}</span>
      </a></li>`).join("")}
    </ul>`,
  }),
  map: (slug) => {
    const m = CONTENT.maps.find((x) => x.slug === slug);
    if (!m) return null;
    return {
      label: `Maps &nbsp;/&nbsp; ${escapeHtml(m.title)} &nbsp;/&nbsp; <a href="#maps">all maps</a>`,
      title: m.title,
      html: `<h2 class="sr-only">${escapeHtml(m.title)}</h2><figure class="map-full">
        <div class="map-images">${m.images.map((im) => `
          <img src="${im.src}" width="${im.width}" height="${im.height}" alt="${escapeHtml(m.alt)}">`).join("")}
        </div>
        ${m.caption ? `<figcaption>${m.caption}</figcaption>` : ""}
      </figure>`,
    };
  },
  list: (category) => {
    const works = CONTENT.works.filter((w) => w.category === category);
    return {
      label: CATEGORIES[category],
      html: `<h2 class="sr-only">${CATEGORIES[category]}</h2>` + (works.length
        ? `<ol class="works">${works.map((w) => `
      <li><a href="#${category}/${w.slug}">
        <span class="works-title">${escapeHtml(w.title)}</span>
        <span class="works-medium">${w.medium}</span>
      </a></li>`).join("")}
    </ol>`
        : `<p class="prose empty">Coming soon.</p>`),
    };
  },
  work: (category, slug) => {
    const w = CONTENT.works.find((x) => x.slug === slug && x.category === category);
    if (!w) return null;
    return {
      label: `${CATEGORIES[category]} &nbsp;/&nbsp; <a href="#${category}">all ${CATEGORIES[category].toLowerCase()}</a>`,
      title: w.title,
      html: `<article class="prose work">
        <h2>${escapeHtml(w.title)}</h2>
        <figure class="hero"><img src="${w.image}" width="${w.width}" height="${w.height}" alt="${escapeHtml(w.alt)}"></figure>
        ${w.html}
      </article>`,
    };
  },
};

function viewFor(section, slug) {
  if (section === "about") return views.about();
  if (section === "maps") return slug ? views.map(slug) : views.maps();
  if (!(section in CATEGORIES)) return null;
  return slug ? views.work(section, slug) : views.list(section);
}

function route() {
  const [section, slug] = location.hash.slice(1).split("/");
  const view = viewFor(section, slug);

  sectionLinks.forEach((a) => a.toggleAttribute("aria-current", Boolean(view) && a.dataset.route === section));
  requestFrame();
  if (!view) {
    const wasOpen = !panel.hidden;
    panel.hidden = true;
    document.body.classList.remove("panel-open");
    document.title = SITE_TITLE;
    if (wasOpen) (returnFocus?.isConnected ? returnFocus : document.querySelector(".masthead h1 a")).focus({ preventScroll: true });
    return;
  }
  if (panel.hidden) returnFocus = document.activeElement !== document.body ? document.activeElement : null;
  document.title = `${view.title || view.label.replace(/ &nbsp;.*/, "")} · ${SITE_TITLE}`;
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
