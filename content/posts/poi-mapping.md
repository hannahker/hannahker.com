---
title: "Exploring Montreal's points of interest (P1)"
date: 2019-10-26T12:41:46-05:00
showDate: true
images:
    - /posts/pois-bar-chart.png
    - /posts/mtl-poi-2.png
---

I take back what I said about mapping in R being easy. This map was a struggle. 

As someone with a lot of interest in [OpenStreetMap](https://www.openstreetmap.org/#map=16/35.6200/139.1242) (OSM), I thought that it would be interesting to play around with some of this data in R. The OSM data on points of interest (POIs) can be particularly rich, so I decided to focus here. With this analysis, I wanted to investigate the spatial distribution of different types of POIs and take a look at how the most common POIs differ across Montreal's boroughs.  

### Preliminary data cleaning

I downloaded the Quebec OSM dataset from [Geofabrik](https://www.geofabrik.de/) and loaded the POIs (point) shapefile into RStudio. Note that there is also a shapefile of polygon POIs. In the interest of simplifying my exercise, I decided to just focus on the points. 


```r
library(sf)
pois_2 <- st_read("qc_data/gis_osm_pois_free_1.shp")
```

I also downloaded administrative boundary shapefiles from [GADM](https://gadm.org/data.html) so that I could clip my OSM data to just the island of Montreal. 

```r
boundary <- st_read("admin/gadm36_CAN_2.shp")
```

Based on the attributes for each polygon in the 'boundary' shapefile, I selected a subset of just the island of Montreal. I then used this new 'mtl' polygon to create a bounding box for the island. In order to subset my OSM data of POIs, I first clipped the POIs to the bounding box, leaving me with a bit of extra data around Montreal, but no longer all of the POI data for Quebec. I then clipped this data according to the specific geometry of Montreal.

I'm not sure that this extra bounding box step was strictly necessary, but I felt that it might reduce some of the processing time of the overall clip. 

```r
# get mtl subset
mtl <- boundary[boundary$GID_2 == "CAN.11.20_1",]

# get the extent of mtl
mtl_extent <- st_bbox(mtl)

# clip the datasets to bounding box of montreal
poi_pt_clip <- st_crop(pois_2, mtl_extent)

# clip to montreal's geometry 
poi_pt_clip <- st_intersection(mtl, poi_pt_clip)
```
Within this dataset, each POI has a number of attributes in addition to location (in coordinates). One of these attributes categorizes each POI with a tag such as "restaurant" or "alpine hut". I further subsetted the data to focus on these tags. 

```r
# explore the types of pois in montreal 
types_pt <- poi_pt_clip[("fclass")]
types_pt <- st_drop_geometry(types_pt)
```
For each uniqe tag, I counted the total number of POIs and ordered them in decreasing frequency. 

```r
# count the number of times each poi occurs
count_pt <- table(types_pt$fclass)
count_pt <- as.data.frame(count_pt)

# order in decreasing frequency
count_pt <- count_pt[order(-count_pt$Freq),]
```

I wanted to visualize the frequency of all types POIs on a bar chart, but given that there were over 100 unique tags, this would be challenging to fit on a single chart. Instead, I took a sample of the top 25 most frequently occurring POI types. 

```r
# subset with the 25 most frequently occurring pois
count_pt_sub <- count_pt[1:25,]
```

I plotted the frequency of each of these POI types on a vertical bar chart. I noticed however, that the tag for each POI wasn't in a very human-readable format. For a better looking graph, I wanted to convert each tag from a format such as "post_box" to "Post Box". 

So, I wrote a function that would split a string at each underscore and capitalize the first letter of each word. 

```r
# function to reformat the text 
humanize <- function(x) {
  s <- strsplit(x, "_")[[1]]
  paste(toupper(substring(s, 1,1)), substring(s, 2),
        sep="", collapse=" ")
}
```
I then wanted to loop through each tag in my dataframe and apply this function. Given, however, that the data in this column was stored as a [factor](https://www.tutorialspoint.com/r/r_factors.htm) and not a list of strings, this took one more step than initially anticipated where I had to convert between these two data types. 

I won't admit how long it took me to figure out that this unexpected data type was the root of my error messages... There may have been a more effective way to manage data when it is stored as a factor, but I was eager to get back to the familiar list data type. 

With this conversion complete, I could then loop through the list of POI types and apply my function to "humanize" the strings. 

```r
# convert column from factor to character 
count_pt_sub["Var1"] <- sapply(count_pt_sub["Var1"], as.character)

# implement humanize function to reformat text for Var1
for (i in 1:length(count_pt_sub$Freq)){
  count_pt_sub$Var1[i] <- humanize(as.character(count_pt_sub$Var1[i]))
}
```

### Exploratory visualization

Finally time to visualize this data on a bar chart! 

```r
library(ggplot2)

# bar chart to visualize 
p<-ggplot(data=count_pt_sub, aes(x=Var1, y=Freq)) +
  geom_bar(stat="identity", fill="steelblue")+
  theme_minimal()
p + coord_flip() + labs(y = "Frequency", x = "Point of Interest")
```
As this graph shows, apparently Montreal is dominated by restaurants, followed (bizarrely?) by benches. I'm not surprised to see the high proportions of cafes, restaurants, and bars. Taking a look at this graph does give me some questions about POI tagging conventions in OSM. For instance, how is a bar differentiated from a pub (given that there are tags for both). I am quite surprised to see the high number of "Camera Surveillance" POIs, and wonder how this would compare with other cities...

![Ideas](/posts/pois-bar-chart.png)

### Making some maps 

To explore the data a bit further, I wanted to make some simple maps to show the spatial distribution of different types of POIs. After wrestling with the data so much previously, making some basic maps was quite straightforward (thanks to [ggplot2](https://ggplot2.tidyverse.org/)). 

I wrote a function to take a couple of inputs, allowing me to quickly create unique maps for a given POI type. 

```r
# function to make a basic map 
# takes the poi tag from OSM data, title, and colour for the points
makemap <- function(poi, title, colour) {
  
  # select the appropriate points
  to_map <- poi_pt_clip[poi_pt_clip$fclass == poi,]
  # create the map, with mtl polygon as background
  p <- ggplot(data=mtl)+
    geom_sf(color = "white", fill = "#39424E")+
    geom_sf(data=to_map, size = 1.5, shape = 1, color = colour, alpha = 0.5)+
    theme_void()+ 
    ggtitle(title)
  # adjust colour and position of title 
  p <- p + theme(
    plot.title = element_text(hjust = 0.5, color = colour)
  )
  return(p)
}

# call the make map function 
cameras <- makemap("camera_surveillance", "Surveillance Cameras", "#cc9c0a")
ffood <- makemap("fast_food", "Fast Food", "#69995d")
bench <- makemap("bench", "Benches", "#6cd4ff")
pbox <- makemap("post_box", "Post Boxes", "#aa4465")
```

I finally used the gridExtra library to output a number of maps in a single, organized png.

```r
# output maps in grid format
library(gridExtra)
grid.arrange(cameras, ffood, bench, pbox, ncol=2)
```
Unsurprisingly, each of the POI types here have dense clusters in Montreal's downtown area. I am assuming that the line of benches along the southeastern corner of Montreal follows the scenic area of the Lachine canal. The apparent regularity in the distribution of surveillance cameras northeast of downtown is also remarkable and may deserve some further investigation!

![Ideas](/posts/mtl-pois.png)



