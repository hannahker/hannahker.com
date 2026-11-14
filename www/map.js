const [MAP_W, MAP_H] = CONTOUR_SIZE;
const MAX_ZOOM = 10;
const TILE = 150;

/* Line weight in screen pixels, and the zoom (pixels per map unit) over which each level fades in */
const LINE_WIDTH = 0.45;
const STYLES = {
  coast: { width: LINE_WIDTH, fadeIn: null },
  index: { width: LINE_WIDTH, fadeIn: null },
  mid: { width: LINE_WIDTH, fadeIn: null },
  minor: { width: LINE_WIDTH, fadeIn: [0.5, 1.3] },
};

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const hint = document.querySelector(".hint");
const styles = getComputedStyle(document.documentElement);
const INK = styles.getPropertyValue("--ink").trim();
const PAPER = styles.getPropertyValue("--paper").trim();
const ACCENT = styles.getPropertyValue("--accent").trim();
const FONTS = {
  name: (size) => `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`,
  role: (size) => `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`,
  link: (size) => `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`,
  nav: (size) => `300 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`,
};

const isAction = (label) => Boolean(label.href || label.route);
const currentSection = () => location.hash.slice(1).split("/")[0];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* Contours, grouped by line type and tile so only visible ones are drawn */
function decode(encoded) {
  const v = encoded.split(",").map(Number);
  const pts = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < v.length; i += 2) {
    x += v[i];
    y += v[i + 1];
    pts.push(x / 10, y / 10);
  }
  return pts;
}

function buildTiles() {
  const tiles = new Map();
  CONTOURS.forEach((group) => {
    group.lines.forEach((encoded) => {
      const pts = decode(encoded);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
        minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
      }
      const key = `${group.kind}:${Math.floor((minX + maxX) / 2 / TILE)},${Math.floor((minY + maxY) / 2 / TILE)}`;
      if (!tiles.has(key)) tiles.set(key, { kind: group.kind, path: new Path2D(), minX, minY, maxX, maxY });
      const tile = tiles.get(key);
      tile.path.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) tile.path.lineTo(pts[i], pts[i + 1]);
      tile.minX = Math.min(tile.minX, minX); tile.maxX = Math.max(tile.maxX, maxX);
      tile.minY = Math.min(tile.minY, minY); tile.maxY = Math.max(tile.maxY, maxY);
    });
  });
  return [...tiles.values()];
}

function levelOpacity(kind, k) {
  const fade = STYLES[kind].fadeIn;
  if (!fade) return 1;
  return clamp((k - fade[0]) / (fade[1] - fade[0]), 0, 1);
}

/* Labels: each glyph's position and angle along its contour, computed once */
function layoutLabel(label) {
  const pts = label.d.slice(1).split(" L").map((p) => p.split(" ").map(Number));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const pointAt = (s) => {
    s = clamp(s, 0, cum[cum.length - 1]);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };

  ctx.font = FONTS[label.kind](label.size);
  const width = ctx.measureText(label.text).width;
  const start = cum[cum.length - 1] * label.at - width / 2;
  const glyphs = [];
  for (let i = 0; i < label.text.length; i++) {
    const before = ctx.measureText(label.text.slice(0, i)).width;
    const advance = ctx.measureText(label.text.slice(0, i + 1)).width - before;
    const mid = start + before + advance / 2;
    const [x, y] = pointAt(mid);
    const [ax, ay] = pointAt(mid - advance / 2);
    const [bx, by] = pointAt(mid + advance / 2);
    glyphs.push({ ch: label.text[i], x, y, angle: Math.atan2(by - ay, bx - ax), advance });
  }
  const centre = pointAt(start + width / 2);
  return { ...label, glyphs, centre: { x: centre[0], y: centre[1] } };
}

const tiles = buildTiles();
let labels = [];

/* View: centre (x, y) in map units, k screen pixels per map unit */
let view = { x: MAP_W / 2, y: MAP_H / 2, k: 1 };
let target = null;
let velocity = null;
let hovered = null;
let focused = null;
let frameRequested = false;
let lastFrame = 0;

const minZoom = () => Math.max(innerWidth / MAP_W, innerHeight / MAP_H);

function constrain(v) {
  const k = clamp(v.k, minZoom(), minZoom() * MAX_ZOOM);
  const halfW = innerWidth / 2 / k;
  const halfH = innerHeight / 2 / k;
  return { k, x: clamp(v.x, halfW, MAP_W - halfW), y: clamp(v.y, halfH, MAP_H - halfH) };
}

function toMap(sx, sy, v = view) {
  return { x: v.x + (sx - innerWidth / 2) / v.k, y: v.y + (sy - innerHeight / 2) / v.k };
}

function zoomedAround(sx, sy, factor, from) {
  const k = clamp(from.k * factor, minZoom(), minZoom() * MAX_ZOOM);
  const p = toMap(sx, sy, from);
  return constrain({ k, x: p.x - (sx - innerWidth / 2) / k, y: p.y - (sy - innerHeight / 2) / k });
}

function requestFrame() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(frame);
}

function frame(now) {
  frameRequested = false;
  const dt = Math.min(48, now - (lastFrame || now - 16.7));
  lastFrame = now;
  let moving = false;

  if (target) {
    const ease = 1 - Math.pow(0.78, dt / 16.7);
    view = {
      x: view.x + (target.x - view.x) * ease,
      y: view.y + (target.y - view.y) * ease,
      k: view.k * Math.pow(target.k / view.k, ease),
    };
    if (Math.abs(target.k / view.k - 1) < 0.0005 && Math.hypot(target.x - view.x, target.y - view.y) * view.k < 0.3) {
      view = target;
      target = null;
    } else {
      moving = true;
    }
  } else if (velocity) {
    view = constrain({ ...view, x: view.x - velocity.x * dt, y: view.y - velocity.y * dt });
    const decay = Math.pow(0.94, dt / 16.7);
    velocity = { x: velocity.x * decay, y: velocity.y * decay };
    if (Math.hypot(velocity.x, velocity.y) * view.k < 0.02) velocity = null;
    else moving = true;
  }

  render();
  if (moving) requestFrame();
  else lastFrame = 0;
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const s = view.k * dpr;
  const left = view.x - innerWidth / 2 / view.k;
  const top = view.y - innerHeight / 2 / view.k;
  const right = left + innerWidth / view.k;
  const bottom = top + innerHeight / view.k;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(s, 0, 0, s, -left * s, -top * s);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  for (const kind of ["minor", "mid", "index", "coast"]) {
    const alpha = levelOpacity(kind, view.k);
    if (!alpha) continue;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = STYLES[kind].width / view.k;
    for (const tile of tiles) {
      if (tile.kind !== kind || tile.maxX < left || tile.minX > right || tile.maxY < top || tile.minY > bottom) continue;
      ctx.stroke(tile.path);
    }
  }
  ctx.globalAlpha = 1;

  drawLabels();
}

function eachGlyph(label, draw) {
  ctx.font = FONTS[label.kind](label.size);
  for (const g of label.glyphs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    draw(g);
    ctx.restore();
  }
}

function drawLabels() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = PAPER;
  for (const label of labels) {
    ctx.lineWidth = label.size * 0.32;
    eachGlyph(label, (g) => ctx.strokeText(g.ch, 0, 0));
  }
  for (const label of labels) {
    const highlighted = isAction(label) && (label === hovered || label === focused || (label.route && label.route === currentSection()));
    ctx.fillStyle = highlighted ? ACCENT : INK;
    eachGlyph(label, (g) => ctx.fillText(g.ch, 0, 0));
  }
}

function linkAt(sx, sy) {
  const p = toMap(sx, sy);
  for (const label of labels) {
    if (!isAction(label)) continue;
    for (const g of label.glyphs) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const along = dx * Math.cos(g.angle) + dy * Math.sin(g.angle);
      const across = -dx * Math.sin(g.angle) + dy * Math.cos(g.angle);
      if (Math.abs(along) <= g.advance / 2 + label.size * 0.15 && Math.abs(across) <= label.size * 0.6) return label;
    }
  }
  return null;
}

function setView(v) {
  view = constrain(v);
  target = null;
  requestFrame();
}

function glideTo(v) {
  target = constrain(v);
  velocity = null;
  requestFrame();
}

/* Default view: the top-right corner (Seymour valley and Indian Arm), with the navigation in the top-left of the screen */
const HOME = { left: 1062, top: 0, k: 1.3 };

function homeView() {
  const k = Math.max(HOME.k, minZoom(), innerWidth / (MAP_W - HOME.left));
  return { k, x: HOME.left + innerWidth / 2 / k, y: HOME.top + innerHeight / 2 / k };
}

/* Rightmost screen x of the labels in a given view, so the panel can sit beside them */
function labelsRightEdge(v) {
  let right = 0;
  for (const label of labels) {
    for (const g of label.glyphs) {
      const reach = (g.advance / 2) * Math.abs(Math.cos(g.angle)) + (label.size / 2) * Math.abs(Math.sin(g.angle));
      right = Math.max(right, innerWidth / 2 + (g.x + reach - v.x) * v.k);
    }
  }
  return right;
}

function dismissHint() {
  hint.classList.add("is-hidden");
}

/* Pointer input: drag pans with momentum, two pointers pinch */
const pointers = new Map();
let pinch = null;
let dragged = false;
let trail = [];

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  target = null;
  velocity = null;
  pinch = null;
  dragged = false;
  trail = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) {
    const link = linkAt(e.clientX, e.clientY);
    if (link !== hovered) {
      hovered = link;
      canvas.classList.toggle("is-over-link", Boolean(link));
      requestFrame();
    }
    return;
  }
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const pts = [...pointers.values()];

  if (pts.length === 1) {
    if (!dragged && Math.hypot(e.clientX - trail[0].x, e.clientY - trail[0].y) < 4) return;
    dragged = true;
    canvas.classList.add("is-dragging");
    setView({ ...view, x: view.x - (e.clientX - prev.x) / view.k, y: view.y - (e.clientY - prev.y) / view.k });
    trail.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    trail = trail.filter((p) => e.timeStamp - p.t < 100);
    dismissHint();
  } else if (pts.length === 2) {
    const [a, b] = pts;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) {
      const zoomed = zoomedAround(mid.x, mid.y, dist / pinch.dist, view);
      setView({ ...zoomed, x: zoomed.x - (mid.x - pinch.mid.x) / zoomed.k, y: zoomed.y - (mid.y - pinch.mid.y) / zoomed.k });
    }
    pinch = { mid, dist };
    dragged = true;
    trail = [];
    dismissHint();
  }
});

function release(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  pinch = null;
  if (pointers.size) return;
  canvas.classList.remove("is-dragging");

  if (!dragged) {
    const link = e.type === "pointerup" && linkAt(e.clientX, e.clientY);
    if (link?.route) location.hash = link.route;
    else if (link) window.open(link.href, "_blank", "noopener");
    return;
  }
  const first = trail[0];
  const last = trail[trail.length - 1];
  if (first && last && last.t - first.t > 10 && e.timeStamp - last.t < 60) {
    const elapsed = last.t - first.t;
    velocity = { x: (last.x - first.x) / elapsed / view.k, y: (last.y - first.y) / elapsed / view.k };
    requestFrame();
  }
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("pointerleave", () => {
  if (hovered && !pointers.size) {
    hovered = null;
    canvas.classList.remove("is-over-link");
    requestFrame();
  }
});

canvas.addEventListener("dblclick", (e) => {
  glideTo(zoomedAround(e.clientX, e.clientY, 2, target || view));
  dismissHint();
});

/* Scrolling and pinching zoom towards the cursor */
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const pixels = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
  const sensitivity = e.ctrlKey ? 0.01 : 0.0025;
  glideTo(zoomedAround(e.clientX, e.clientY, Math.exp(-pixels * sensitivity), target || view));
  dismissHint();
}, { passive: false });

document.addEventListener("keydown", (e) => {
  if (document.body.classList.contains("panel-open") || e.target.closest?.(".panel")) return;
  const from = target || view;
  const step = 100 / from.k;
  const pans = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (pans[e.key]) glideTo({ ...from, x: from.x + pans[e.key][0], y: from.y + pans[e.key][1] });
  else if (e.key === "+" || e.key === "=") glideTo(zoomedAround(innerWidth / 2, innerHeight / 2, 1.6, from));
  else if (e.key === "-") glideTo(zoomedAround(innerWidth / 2, innerHeight / 2, 1 / 1.6, from));
  else if (e.key === "0") glideTo(homeView());
  else return;
  e.preventDefault();
  dismissHint();
});

/* Hidden real links for keyboard and screen-reader users */
function buildLinkList() {
  const nav = document.getElementById("links");
  LABELS.forEach((label, i) => {
    if (!label.href) return;
    const a = document.createElement("a");
    a.href = label.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label.text;
    a.addEventListener("focus", () => {
      focused = labels[i];
      glideTo({ ...view, x: labels[i].centre.x, y: labels[i].centre.y });
    });
    a.addEventListener("blur", () => {
      focused = null;
      requestFrame();
    });
    nav.append(a);
  });
}

document.querySelector(".reset-view").addEventListener("click", () => {
  glideTo(homeView());
  dismissHint();
});

function sizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
}

window.addEventListener("resize", () => {
  sizeCanvas();
  setView(view);
});

function layout() {
  labels = LABELS.map(layoutLabel);
}

layout();
buildLinkList();
sizeCanvas();
setView(homeView());
Promise.all(LABELS.map((l) => document.fonts.load(FONTS[l.kind](l.size)))).then(() => {
  layout();
  requestFrame();
});
