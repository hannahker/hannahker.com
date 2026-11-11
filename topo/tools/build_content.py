"""Build the panel content from topo/about.md and the Selected Works Markdown in content/.

Usage, from topo/: python3 tools/build_content.py
"""
import json
import re
from pathlib import Path

import markdown

TOPO = Path(__file__).resolve().parent.parent
CONTENT = TOPO.parent / "content"
WEB = TOPO.parent / "www"

IMAGES = {
    "/posts/mind-map.png": ("mind-map.png", 1600, 1045),
    "/posts/blender.png": ("shaded-relief.jpg", 1600, 762),
    "/research/map.PNG": ("emotional-map.jpg", 1600, 729),
    "/research/orange.png": ("orange-julep.jpg", 1600, 855),
    "/research/cup.png": ("orange-julep-cup.jpg", 1600, 916),
}

WORKS = [
    dict(slug="image-of-london", source="maps/image-post.md", hero="/posts/mind-map.png",
         alt="Hand-drawn mental map of London around Goodenough College",
         unit="unit 0001.", medium="pen on paper", group="maps"),
    dict(slug="shaded-relief", source="maps/blender.md", hero="/posts/blender.png",
         alt="Shaded relief maps of Ayacucho, Peru and British Columbia, Canada",
         unit="unit 0002.", medium="Blender, R", group="maps"),
    dict(slug="emotional-cartography", source="research/emotion.md", hero="/research/map.PNG",
         alt="Interactive map of heart rate and personal comments across central London",
         unit="unit 0003.", medium="R, QGIS, Leaflet", group="research"),
    dict(slug="cultural-landscapes", source="research/oj.md", hero="/research/orange.png",
         alt="Ink drawing of an orange slice",
         unit="unit 0004.", medium="ink, photography", group="research"),
]


def read_markdown(path):
    _, front, body = (CONTENT / path).read_text().split("---", 2)
    return re.search(r'^title:\s*"(.*)"', front, re.M).group(1), body


def to_html(body):
    html = markdown.markdown(body, extensions=["fenced_code", "footnotes", "md_in_html"])
    html = re.sub(r'\s*<a class="footnote-backref"[^>]*>.*?</a>', "", html)
    html = re.sub(r'<sup id="fnref\d*:[^"]*"><a class="footnote-ref" href="#fn:[^"]*">(\d+)</a></sup>', r"<sup>\1</sup>", html)
    html = re.sub(r'<div class="footnote">\s*<hr\s*/?>\s*<ol>', '<ol class="footnotes">', html)
    html = re.sub(r"</ol>\s*</div>\s*$", "</ol>", html.strip())
    html = re.sub(r' id="fn:[^"]*"', "", html)
    for src, (name, w, h) in IMAGES.items():
        html = html.replace(f'src="{src}"', f'src="images/{name}" width="{w}" height="{h}" loading="lazy"')
    html = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', html)
    return re.sub(r"<hr\s*/?>", "<hr>", html)


def about():
    return to_html((TOPO / "about.md").read_text())


def work(spec):
    title, body = read_markdown(spec["source"])
    body = re.sub(r"^\s*!\[[^\]]*\]\(" + re.escape(spec["hero"]) + r"\)\s*", "", body)
    body = re.sub(r"^\s*---\s*\n", "", body)
    name, w, h = IMAGES[spec["hero"]]
    return {k: spec[k] for k in ("slug", "alt", "unit", "medium", "group")} | {
        "title": title, "image": f"images/{name}", "width": w, "height": h, "html": to_html(body),
    }


content = {"about": about(), "works": [work(w) for w in WORKS]}
(WEB / "content.js").write_text("const CONTENT = " + json.dumps(content, indent=1) + ";\n")
print(f"content.js: about + {len(content['works'])} works")
