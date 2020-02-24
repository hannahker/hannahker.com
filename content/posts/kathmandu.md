---
title: "Elevation in Kathmandu with Rayshader"
date: 2020-02-23T12:41:46-05:00
showDate: false
images:
    - /posts/kathmandu.png
---

![Ideas](/posts/kathmandu.png)

---

Continuing again with the minimal map theme from my last post. This time, I was doing my best to replicate the gorgeous style of [these maps](https://www.mapmakerdavid.com/) from David Garcia. My map is a pretty simple application of R's [Rayshader](https://www.rayshader.com/) package (which also has the capacity for some pretty amazing 3D visualizations).  

### Reading and processing the data 

I downloaded a shapefile of Nepal with administrative boundaries from [GADM](https://gadm.org/data.html) and downloaded elevation data for my area of interest from [Open Topography](https://www.opentopography.org/). 

After reading in this data, I first selected a subset of the Kathmandu district from my larger shapefile. I then masked the elevation raster with this Kathmandu boundary and converted the resulting data into a matrix format. 

```r
# load libraries
library(rayshader)
library(sf)
library(raster)

elev <- raster('kath.tif') # load the raster data
nepal <- st_read('nepal/gadm36_NPL_3.shp') # load shapefile data
kath <- subset(nepal,nepal$NAME_3=='Kathmandu') # get subset of just kathmandu area
e <- extent(kath) # get the extent of Kathmandu

cropped <- raster::crop(elev, e) # crop to extent of polygon
masked <- raster::mask(cropped, kath) # crop raster by ploygon

elmat = raster_to_matrix(cropped_big) # convert the raster to a matrix
```
### Making the map

Rayshader's documentation has an example that I could pretty directly apply to create the map that I was aiming for. As shown below, I calculated several types of shading, then visualized and saved the results.  

```r
# calculate shadow layers 
ambient <- ambient_shade(elmat, 0)
ray <- ray_shade(elmat, 0.5, lambert = TRUE)

filename_map = 'kathmandu-large.png' # output file name 

# create the map 
elmat %>%
  sphere_shade(texture = "imhof3") %>%
  add_shadow(ray, max_darken = 0.5) %>%
  add_shadow(ambient, max_darken = 0.5) %>%
  save_png(filename_map, dpi=300)
```
I also spent a while playing around with the contrast and colour scheme of this map in Gimp (a free alternative to Photoshop). 

---


