Source for the topographic home page published from `../www/`.

- `about.md`: About panel text.
- `data/cded/`: CDED 1:50k DEM tiles 092g02_w, 092g03_e, 092g03_w, 092g06_e, 092g06_w, 092g07_w from https://pub.data.gov.bc.ca/datasets/175624/ (not committed).
- `tools/`: run from this folder.
  - `dem_contours.py` builds `../www/contours-data.js` from the DEM tiles.
  - `find_lines.py` and `place_labels.py` place the nav labels and write `../www/labels.js`.
  - `build_content.py` builds `../www/content.js` from `about.md` and the posts in `../content/`.
