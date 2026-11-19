"""Build the panel content from topo/about.md and the Selected Works Markdown in content/.

Usage, from topo/: python3 tools/build_content.py
"""
import json
import re
from pathlib import Path

import markdown
from PIL import Image

TOPO = Path(__file__).resolve().parent.parent
CONTENT = TOPO.parent / "content"
WEB = TOPO.parent / "www"

IMAGES = {
    "/research/map.PNG": ("emotional-map.jpg", 1600, 729),
    "/research/orange.png": ("orange-julep.jpg", 1600, 855),
    "/research/cup.png": ("orange-julep-cup.jpg", 1600, 916),
    "/posts/eagles.PNG": ("eagles.jpg", 1600, 764),
    "/posts/fisher.PNG": ("fishers.jpg", 1325, 742),
    "/research/predict.png": ("svr-predictions.png", 1600, 537),
    "/research/selected_links_v2.png": ("svr-road-links.jpg", 1600, 1321),
    "/research/mape_results.png": ("svr-mape.png", 1600, 719),
    "/projects/vancouver-guide.jpg": ("vancouver-guide.jpg", 1200, 753),
}

ALT = {
    "/research/cup.png": "An Orange Julep cup and a paper takeout bag on a window ledge",
    "/posts/fisher.PNG": "Animated web map of one fisher's path through Albany, with GPS points coloured by time since the previous point",
    "/research/selected_links_v2.png": "Map of central London with the 22 selected road links highlighted in red",
    "/research/mape_results.png": "Chart comparing the error (MAPE) of the SVR model with STARIMA and LSTM models",
}

WORKS = [
    dict(slug="vancouver-guide", subtitle="Personal project, 2025", source="projects/vancouver-guide.md", hero="/projects/vancouver-guide.jpg",
         alt="Cover of Hannah's Vancouver: a line drawing of the North Shore mountains",
         medium="InDesign, drawing", category="projects", keep_layout=True),
    dict(slug="emotional-cartography", subtitle="Graduate coursework, 2020", source="research/emotion.md", hero="/research/map.PNG",
         alt="Interactive map of heart rate and personal comments across central London",
         medium="R, QGIS, Leaflet", category="projects"),
    dict(slug="cultural-landscapes", subtitle="Undergraduate coursework, 2018", source="research/oj.md", hero="/research/orange.png",
         alt="Ink drawing of an orange slice",
         medium="ink, photography", category="projects", keep_layout=True),
    dict(slug="animal-movement", subtitle="Graduate coursework, 2020", source="maps/eagles.md", hero="/posts/eagles.PNG",
         alt="Web map of eagle GPS tracks along the coast of British Columbia",
         medium="Mapbox GL JS, d3.js, R", category="projects"),
    dict(slug="travel-time-prediction", subtitle="Graduate coursework, 2020", source="research/traffic.md", hero="/research/predict.png",
         alt="Chart of actual against predicted travel times for one London road link",
         medium="R, caret", category="projects"),
]
ALT |= {w["hero"]: w["alt"] for w in WORKS}

MAPS = [
    dict(slug="shaded-relief-british-columbia", title="Shaded relief: British Columbia", caption="British Columbia shaded relief (2020)",
         images=["relief-british-columbia.jpg"], alt="Shaded relief map of British Columbia, Canada"),
    dict(slug="shaded-relief-ayacucho", title="Shaded relief: Ayacucho", caption="Ayacucho shaded relief (2020)",
         images=["relief-ayacucho.jpg"], alt="Shaded relief map of Ayacucho, Peru"),
    dict(slug="st-lawrence", title="False colour composite", caption="Outside Montreal false colour composite (2018)",
         images=["st-lawrence-false-colour.jpg"],
         alt="False colour satellite image of the St. Lawrence River and Lac Saint-Pierre, Quebec"),
    dict(slug="human-modification", title="Global human modification", caption="Global human modification on terrestrial ecosystems (2020)",
         images=["human-modification.jpg"],
         alt="World map of the global human modification of terrestrial systems", focus="center 20%"),
    dict(slug="image-of-london", title="Image of London", caption="Kevin Lynch inspired London :) (2019)",
         images=["mind-map.png"],
         alt="Hand-drawn mental map of London around Goodenough College"),
]
THUMB_WIDTH = 640


def image_info(name):
    with Image.open(WEB / "images" / name) as im:
        return {"src": f"images/{name}", "width": im.width, "height": im.height}


def map_entry(spec):
    """Map metadata for the panel, writing its grid thumbnail."""
    source = spec.get("thumb", spec["images"][0])
    thumb = Image.open(WEB / "images" / source)
    thumb.thumbnail((THUMB_WIDTH, THUMB_WIDTH * 4))
    thumb_name = "thumbs/" + Path(source).with_suffix(".jpg").name
    (WEB / "images" / "thumbs").mkdir(exist_ok=True)
    thumb.convert("RGB").save(WEB / "images" / thumb_name, quality=85)
    return {k: spec[k] for k in ("slug", "title", "alt")} | {
        "images": [image_info(name) for name in spec["images"]], "thumb": f"images/{thumb_name}",
        "focus": spec.get("focus", "center"),
        "caption": to_html(spec["caption"]).removeprefix("<p>").removesuffix("</p>") if spec["caption"] else "",
    }


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
        html = html.replace(f'alt="" src="{src}"', f'alt="{ALT.get(src, "")}" src="{src}"')
        html = html.replace(f'src="{src}"', f'src="images/{name}" width="{w}" height="{h}" loading="lazy"')
    html = re.sub(r'<a href="(https?://[^"]+)"', r'<a href="\1" target="_blank" rel="noopener"', html)
    return re.sub(r"<hr\s*/?>", "<hr>", html)


def about():
    return to_html((TOPO / "about.md").read_text())


def move_lead_image(body):
    """Move a leading image and its caption to the end of the first section, so articles open with text."""
    blocks = re.split(r"\n\s*\n", body.strip())
    if not blocks[0].startswith("!["):
        return body
    n = 2 if blocks[1].startswith("<div") else 1
    lead, rest = blocks[:n], blocks[n:]
    headings = [i for i, b in enumerate(rest) if b.startswith("#")]
    at = headings[1] if len(headings) > 1 else min(2, len(rest))
    return "\n\n".join(rest[:at] + lead + rest[at:])


def work(spec):
    title, body = read_markdown(spec["source"])
    body = re.sub(r"^\s*---\s*\n", "", body)
    if not spec.get("keep_layout"):
        body = move_lead_image(body)
    return {k: spec[k] for k in ("slug", "category")} | {"title": title, "subtitle": spec.get("subtitle", ""), "html": to_html(body)}


content = {
    "about": about(),
    "maps": [map_entry(m) for m in MAPS],
    "works": [work(w) for w in WORKS],
}
(WEB / "content.js").write_text("const CONTENT = " + json.dumps(content, indent=1) + ";\n")
print(f"content.js: about + {len(content['maps'])} maps + {len(content['works'])} works")
