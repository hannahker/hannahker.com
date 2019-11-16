---
title: "Exploring Montreal's points of interest"
date: 2019-10-26T12:41:46-05:00
showDate: false
images:
    - /posts/pois-bar-chart.png
    - /posts/playgrounds.png
    - /posts/ah-west-chart.png
    - /posts/mtl-pois.png
    - /posts/pc.png
---

![Ideas](/posts/playgrounds.png)

---

I take back what I said about mapping in R being easy. Throughout this process, I am ashamed to admit how often I thought about how easy this would be to do in ArcMap...

As someone with a lot of interest in [OpenStreetMap](https://www.openstreetmap.org/#map=16/35.6200/139.1242) (OSM), I thought that it would be interesting to play around with some of this data in R. The OSM data on points of interest (POIs) can be particularly rich, so I decided to focus here. With this analysis, I wanted to investigate the spatial distribution of different types of POIs and take a look at how the most common POIs differ across Montreal's boroughs.  

### Reading in the data 

I downloaded the Quebec OSM dataset from [Geofabrik](https://www.geofabrik.de/) and loaded the POIs (point) shapefile into RStudio. Note that there is also a shapefile of polygon POIs. In the interest of simplifying my exercise, I decided to just focus on the points. Each POI is tagged with an attribute to classify its type, such as 'alpine_hut' or 'restaurant'. I focused on these tags in my exploratory visualization expercise. 

```r
library(sf)
pois <- st_read("qc_data/gis_osm_pois_free_1.shp")
```

I also used a shapefile of all boroughs (and municipalities) on the island of Montreal that I had downloaded from a previous project. Unfortunately I can't remember where I initially downloaded this from... 

```r
boroughs <- st_read("admin/Montreal-boroughs-and-municipalities.shp")
```

Anticipating my future needs, I wrote a function to clip the pois by different boroughs in Montreal. 

```r
clippoints <- function(points, geometry){
  clipped <- st_intersection(geometry, points)
}
```

### Exploring the data 

I wanted to visualize the frequency of all types POIs on a bar chart, but given that there were over 100 unique tags, this would be challenging to fit on a single chart. Instead, I took a sample of the top 25 most frequently occurring POI types. 

To create this chart, I transformed my list of POIs into a list of unique POI types and the number of times that each of them occurred in the dataset. I sorted this list in descending order and took a look at the top 25. 

```r
  # explore the types of pois in montreal 
  types_pt <- toplot[("fclass")]
  types_pt <- st_drop_geometry(types_pt)
  
  # count the number of times each poi occurs
  count_pt <- table(types_pt$fclass)
  count_pt <- as.data.frame(count_pt)
  
  # sort
  count_pt <- count_pt[order(-count_pt$Freq),] 
  
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

I could finally make a nice-looking bar chart! 

```r
library(ggplot2)

  p<-ggplot(data=count_pt_sub, aes(x=Var1, y=Freq)) +
    geom_bar(stat="identity", fill=colour)+
    ggtitle(title)
  
  p <- p + coord_flip() + 
    labs(y = "Frequency", x = "Point of Interest") +
    theme_map()
```

![Ideas](/posts/pois-bar-chart.png)

As this graph shows, apparently Montreal is dominated by restaurants, followed (bizarrely?) by benches. I'm not surprised to see the high proportions of cafes, restaurants, and bars. Taking a look at this graph does give me some questions about POI tagging conventions in OSM. For instance, how is a bar differentiated from a pub (given that there are tags for both)? I am quite surprised to see the high number of "Camera Surveillance" POIs, and wonder how this would compare with other cities...

I also tweaked one of the base ggplot themes somewhat, and used this style throughout my graphs/maps 

```r
# adapted from:
# https://timogrossenbacher.ch/2016/12/beautiful-thematic-maps-with-ggplot2-only/#a-better-color-scale
theme_map <- function(...) {
  theme_minimal() +
    theme(
      text = element_text(color = "#22211d", family = "Calibri"),
      panel.grid.major = element_line(color = "#ebebe5", size = 0.2),
      panel.grid.minor = element_blank(),
      plot.background = element_rect(fill = "#f0f2f5", color = NA), 
      panel.background = element_rect(fill = "#f0f2f5", color = NA), 
      legend.background = element_rect(fill = "#f0f2f5", color = NA),
      panel.border = element_blank(),
      legend.title = element_text(size = 12, 
                                  color = "#939184"),
      legend.text = element_text(size = 9, hjust = 0,
                                 color = "#939184"),
      plot.title = element_text(size = 11, hjust = 0.5,
                                color = "#939184"),
      plot.caption = element_text(size = 7,
                                  hjust = .5,
                                  margin = margin(t = 0.2,
                                                  b = 0,
                                                  unit = "cm"),
                                  color = "#939184"),
      ...
    )
}
```

### Making some maps 

I also wrote a function to make choropleth maps showing the distribution of different types of POIs throughout Montreal. The basic plotting the the map was simple enough. Rather, I've found that it's programming the formatting and simple design into R that is making me want to bang my head against a wall. 

```r

poi_count <- function(poi, ltitle){
  
  # get subset of pois
  poi_sub <- all[all$fclass == poi,]
  # poi_sub <- all[all$name == poi,]
  
  # join poi with borough geometry 
  joined <- st_join(poi_sub, boroughs, join = st_within)
  
  # count the number of pois per borough
  countno <- as.data.frame(plyr::count(joined$NOM.x))
  
  # join the count back to the borough layer
  counted <-left_join(boroughs, countno, by=c("NOM"="x"))
  
  # change NA to zero
  counted$freq[is.na(counted$freq)] <- 0
  
  # make the map
  a <- ggplot() +
    geom_sf(data = counted, aes(fill = counted$freq), color = "#39424E", size = 0.05) +
    theme_map() + 
    labs(caption = "Data from OpenStreetMap \n Developed by Hannah Ker")
  
  p <- a + 
    theme(
      legend.position = "bottom",
      axis.line = element_blank(),
      axis.text.x = element_blank(),
      axis.text.y = element_blank(),
      axis.ticks = element_blank(),
      axis.title.x = element_blank(),
      axis.title.y = element_blank()) +
    scale_fill_distiller(
      palette = "BuPu", 
      direction = 1,
      # set title of the legend
      name = ltitle,
      # here we use guide_colourbar because it is still a continuous scale
      guide = guide_colorbar(
        # set horizontal
        direction = "horizontal",
        # adjust the size of the rectangle 
        barheight = unit(2, units = "mm"),
        barwidth = unit(50, units = "mm"),
        # legend title goes on top of legend
        title.position = 'top',
        # some shifting around
        title.hjust = 0.5,
        label.hjust = 0.5
      ))
  
  return(p)
} 
```
The maps below show the distribution, grouped by borough, of surveillance cameras and playgrounds in Montreal. When making the maps, I was trying to find something that wasn't clustered completely around Montreal's downtown core. Turns out that, unsurprisingly, playgrounds are distributed somewhat more evenly throughout the island. 

I am also a little scared at the idea of there being so many surveillance cameras in Montreal, and wanted to see where they were most common. The Plateau and Ville Marie boroughs appear to have many more cameras than anywhere else in the island, as perhaps could be predicted by the increased population density in these areas. 

![Ideas](/posts/surveillance.png)

---

*Check out the full code for this exercise [here]()*


