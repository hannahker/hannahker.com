const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
const panelLabel = document.getElementById("panel-label");
const sectionLinks = document.querySelectorAll(".masthead [data-route]");

const SITE_TITLE = document.title;
let returnFocus = null;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const PROJECTS = CONTENT.works.filter((w) => w.category === "projects");

function mapsView(slug) {
  const maps = CONTENT.maps;
  const start = slug ? maps.findIndex((m) => m.slug === slug) : 0;
  if (start < 0) return null;
  return {
    label: `Maps &nbsp;/&nbsp; <span class="gallery-title"></span>`,
    title: maps[start].title,
    html: `<h2 class="sr-only">Maps</h2><div class="gallery">
      <ul class="gallery-track" tabindex="0" aria-label="Maps">${maps.map((m, i) => `
        <li class="gallery-slide" aria-label="${i + 1} of ${maps.length}: ${escapeHtml(m.title)}"><figure class="map-full">
          <div class="map-images">${m.images.map((im) => `
            <img src="${im.src}" width="${im.width}" height="${im.height}" alt="${escapeHtml(m.alt)}"${i === start ? "" : ' loading="lazy"'}>`).join("")}
          </div>
          ${m.caption ? `<figcaption>${m.caption}</figcaption>` : ""}
        </figure></li>`).join("")}
      </ul>
      <div class="gallery-controls">
        <button type="button" data-step="-1">&larr; previous</button>
        <span class="gallery-count" aria-live="polite"></span>
        <button type="button" data-step="1">next &rarr;</button>
      </div>
    </div>`,
    onShow: () => initGallery(start),
  };
}

function projectsView(slug) {
  const i = slug ? PROJECTS.findIndex((w) => w.slug === slug) : 0;
  const w = PROJECTS[i];
  if (!w) return null;
  return {
    label: `<a href="#projects">Special Projects</a> &nbsp;/&nbsp; ${escapeHtml(w.title)}`,
    title: w.title,
    html: `<div class="articles">
      <nav class="article-index" aria-label="Special projects"><ol>${PROJECTS.map((p) => `
        <li><a href="#projects/${p.slug}"${p === w ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a></li>`).join("")}
      </ol></nav>
      <article class="prose work">
        <h2>${escapeHtml(w.title)}</h2>
        ${w.subtitle ? `<p class="work-subtitle">${escapeHtml(w.subtitle)}</p>` : ""}
        ${w.html}
      </article>
    </div>`,
  };
}

function initGallery(start) {
  const maps = CONTENT.maps;
  const track = panelBody.querySelector(".gallery-track");
  const [prev, next] = panelBody.querySelectorAll(".gallery-controls button");
  const last = maps.length - 1;
  let current = -1;

  const show = (i) => {
    if (i === current) return;
    current = i;
    panelLabel.querySelector(".gallery-title").textContent = maps[i].title;
    panelBody.querySelector(".gallery-count").textContent = `${i + 1} / ${last + 1}`;
    prev.disabled = i === 0;
    next.disabled = i === last;
    document.title = `${maps[i].title} · ${SITE_TITLE}`;
    history.replaceState(null, "", `#maps/${maps[i].slug}`);
  };
  const go = (i) => track.scrollTo({ left: clamp(i, 0, last) * track.clientWidth, behavior: reducedMotion.matches ? "auto" : "smooth" });

  track.scrollLeft = start * track.clientWidth;
  show(start);
  track.addEventListener("scroll", () => show(clamp(Math.round(track.scrollLeft / track.clientWidth), 0, last)), { passive: true });
  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
}

function viewFor(section, slug) {
  if (section === "about") return { label: "About", html: `<article class="prose"><h2 class="sr-only">About</h2>${CONTENT.about}</article>` };
  if (section === "maps") return mapsView(slug);
  if (section === "projects") return projectsView(slug);
  return null;
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
  view.onShow?.();
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
  const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
  const button = step && !panel.hidden && panelBody.querySelector(`.gallery [data-step="${step}"]`);
  if (button) {
    e.preventDefault();
    button.click();
  }
});

window.addEventListener("hashchange", route);
route();
