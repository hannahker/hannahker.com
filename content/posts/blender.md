---
title: "Shaded relief in Blender and R"
date: 2020-04-01T12:41:46-05:00
showDate: false
images:
    - /posts/blender.png
---

![Ideas](/posts/blender.png)

---

I've stepped up from my previous work with rayshader, instead using Blender to create a similarly-styled elevation map. This work is drawn heavily from the [amazing tutorial](https://somethingaboutmaps.wordpress.com/2017/11/16/creating-shaded-relief-in-blender/) from Daniel Huffman, as well as the Blender [tutorial materials](https://www.mapmakerdavid.com/) from David Garcia. Aside from some styling at the end, I followed this material pretty closely, so I won't bother replicating the walkthrough. 

I used elevation data from [GEBCO](https://www.gebco.net/data_and_products/gridded_bathymetry_data/#area), which has a very handy tool for selecting data for a given area using a bounding box. This data also includes sea level elevation (bathymetry). The resolution is relatively coarse, at 15 arc-seconds (approx 450m per pixel), so is best for larger areas. Administrative boundaries are from [GADM](https://gadm.org/data.html). 

In addition to rendering the data in Blender according to the tutorials linked above, I created a short script in R for preprocessing. 

First, load the following libraries:
```r
library(raster)
library(rgdal)
library(sf)
```

Then we can load in the elevation and administrative datasets. 

```r
grid <- raster('bc.tif') # get the raster
bounds <- st_read('gadm36_CAN_shp/gadm36_CAN_1.shp') # get the polygon
bounds <- as_Spatial(bounds[bounds$NAME_1=='British Columbia',]) # subset the polygon
```

The ultimate visualization goal was to have the area of interest 'rise' up above the rest of the (blank) background, leaving a shadowed border. This look is inspired by the gorgeous maps of a similar style from [Scott Reinhard](https://scottreinhardmaps.com/). This can be achieved in Blender by reclassifying all data outside of the area of interest to have an elevation of 0. 

The first task is to create a bounding box, extending on each side just beyond the bounds of the administrative boundary. For standardization across multiple maps, I also created a function to transform this rectangular bounding box into a square, by evenly extending the length of the shortest side.  
```r
ext <- extent(bounds)*1.2 # get extent of polygon

# turn a bounding box into a square 
makesquare <- function(boundbox){
  
  new <- boundbox
  
  ylength <- new@ymax-new@ymin
  xlength <- new@xmax-new@xmin
  diff <- xlength - ylength
  
  # if x side is longer
  if(diff > 0){
    # add half the length of the diff to each y coord
    new@ymax <- (abs(new@ymax) + (diff/2))*(new@ymax/abs(new@ymax))
    new@ymin <- (abs(new@ymin) - (diff/2))*(new@ymin/abs(new@ymin))
  }
  # if y side is longer 
  if(diff<0){
    new@xmax <- (abs(new@xmax) + (diff/2))*(new@xmax/abs(new@xmax))
    new@xmin <- (abs(new@xmin) - (diff/2))*(new@xmin/abs(new@xmin))
  }
  else{
    print('already a square')
  }
  
  return(new)
}

box <- crop(grid, makesquare(ext)) # clip the raster by the square extent
```

Now, I won't pretend to have mastered working with raster datasets in R, so this next bit is rather convoluted. I needed to transform the elevation values to be within the range of 0 - 65535 (for input to Blender, as explained by Daniel Huffman's tutorial), with all the pixels outside of the administrative boundary to be classified as 0. 

I had a hard time trying to select all pixels that were **outside** of the administrative boundary, so here we instead set all pixels **within** the boundary to an arbitrarily small value that definitely wouldn't be part of the real data. 

```r
box <- round((box-minValue(box))/(maxValue(box)-minValue(box))*65535) # rescale and round to 0 - 65535 range 
box[bounds[,]] <- -10000 # set values within the polygon to be -10,000
```

We then reclassify these values to be 0, and create a layer where the values inside the area of interest are set as 1. 

```r
m <- c(-9999, maxValue(box), 0) # reclasify values (min, max, new)
m <- matrix(m, ncol=3, byrow = T) # convert to matrix
reclass <- reclassify(box, m, right = T) # set all values outside area of interest to be 0

area <- reclass==-10000 # values at 1 within the area of interest and 0 outside
```

Finally, we multiply this layer with just 1's and 0's with the layer with rescaled elevation values. We then export this later to a .tif file. 

```r
area <- area*copy
writeRaster(area, filename='bc.tif', format='GTiff', overwrite=TRUE)
```

Before putting this file into Blender, we need to transform the raster data type. I'm sure that this could be done in R as well, but I was feeling rather lazy at this point and knew how to do it easily in QGIS. Using the 'Translate' tool, simply convert the raster to the 'UInt16' data type. 

Once the elevation data was rendered in Blender, I used Photoshop to tinker with the colouring and add a title. 






 
