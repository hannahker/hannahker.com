---
title: "Using NLP to analyze OpenStreetMap changeset discussions"
date: 2019-01-19T12:41:46-05:00
showDate: false
tags: ["blog","story"]
images:
    - /research/lda-small.PNG
    - /research/lda.PNG
    - /research/topics.PNG

---

![](/research/lda.PNG)

### Overview 

I used topic modelling and sentiment analysis to computationally investigate OpenStreetMap (OSM) changeset discussions. Specifically, I explored the following research question: What is the subject and tone of OSM changeset discussions between contributors in the United States over the past 90 days?

### Rationale

In this project, I analyzed communication patterns between OpenStreetMap (OSM) contributors relating to their mapping activities. Since 2014, contributors have had the ability to engage in public discussions directly related to a given OSM changeset. A changeset is a discrete group of edits made by a single contributor within a short period of time. As described in the [blog post](https://blog.openstreetmap.org/2014/11/02/introducing-changeset-discussions/) introducing this feature, changeset discussions are intended to be a place for “welcoming new users”, “leaving positive feedback”, and “asking questions about controversial edits”. New mappers may also flag their map edits to request feedback from more experienced mappers.[^1] 

Given the importance placed on building community within the OSM project, it is relevant to research existing modes of engagement between contributors. Survey research has found that, particularly among more experienced OSM mappers, community engagement is a key motivator for sustained contribution to the project.[^2] 

The results of this analysis may also have implications for ongoing efforts to promote inclusion in OSM (as evidenced by the recent appointment of a [“Diversity and Inclusion Special Committee”](https://wiki.osmfoundation.org/wiki/Diversity_and_Inclusion_Special_Committee)). Research has found that the vast majority of OSM contributors are male.[^3] Research relating to Wikipedia, a similar online crowdsourcing project, has found that many women have stopped contributing due to experiences of conflict with other contributors during online discussions.[^4]

### Methods 

I began by scraping the text content from 2020 changeset discussions in the United States over the last 90 days (using links from [this page](http://resultmaps.neis-one.org/osm-discussions?c=United%20States&d=90#5/-20.978/-121.904)). Each discussion thread has an average of 1.47 comments, indicating that the majority of "discussions" are one-sided. Very few discussion threads have more than 6 comments. 

After scraping the data, I analyzed it in three primary steps: 1) Cleaning and normalizing to transform it into a format appropriate for topic modelling, 2) Applying Latent Dirichlet Allocation (LDA) to detect commonly occurring topics in these changeset discussions, 3) Applying a rule-based sentiment analysis model to understand the emotional tone of each discussion in the dataset.

I used Python's [Gensim](https://radimrehurek.com/gensim/) to implement LDA, and [VADER](https://github.com/cjhutto/vaderSentiment) to conduct a simple sentiment analysis. 

### Main results

The figure above presents the 11 topics that were derived from this dataset, each defined by a number of key terms. My interpretation indicated that these topics were relating to both mapping activities (eg. tracing satellite imagery) and mapping subjects (eg. roads and buildings). The topics output from LDA are not guaranteed to be easily interpretable by a human eye, so it can be sometimes challenging to derive meaning from these results. I'll note that some topics were quite clear to interpret, but others less so. 

The polarity scores output by VADER indicate that the majority of discussions have a neutral or positive tone. The figure below shows the distribution of polarity scores for discussions across all of the topics. 

![](/research/topics.PNG)

It appears as though many contributors engage productively and politely when discussing changesets to the map, as evidenced by the following excerpts from the large number of positively scored discussion threads: 

- _Hi, and welcome to OSM! After reviewing the change, it looks like you accidentally dragged the node at the intersection a short distance. I've already undone the change (to keep the road straight). Thanks for editing!_
- _I continue to be truly impressed with the combination of local knowledge and good OSM tagging. Please, keep up the great work!_

While our analysis finds a low prevalence of negative comments, a manual review of some of these comments reveals trends in the tensions between some OSM contributors. For example, a number of discussions address the tension between perceived ‘local’ vs ‘armchair’ (ie. remote) mappers, as shown by the following excerpts: 

- _You don't work here. You don't live here. You don't survey here. You do not use the transit system here. That is armchair mapping._ 
- _You are coming off as real demanding as an arm chair mapper._

It is important to note the limitations of this computational analysis. Firstly, the process of interpreting topic outputs from LDA is highly subjective. A manual inspection of some results from the sentiment analysis also reveals that some discussion threads may contain nuanced tones that cannot be easily understood by VADER’s rule-based approach. While computational analysis such as this may be useful at helping one to understand large volumes of text, some manual review may still be required to gain meaningful insight from the data.

---

A detailed description of the full analysis and results can be viewed in [this Jupyter Notebook](https://github.com/hannahker/research-projects/blob/master/osm-changesets/Analysis_ChangesetDiscussions.ipynb).

[^1]: Neis, P., 2017a. Review requests of OpenStreetMap contributors. URL https://neis-one.org/2017/09/review-requests-osm/ (accessed 4.28.20).
[^2]: Budhathoki, N.R., Haythornthwaite, C., 2013. Motivation for Open Collaboration: Crowd and Community Models and the Case of OpenStreetMap. Am. Behav. Sci. 57, 548–575. https://doi.org/10.1177/0002764212469364
[^3]: Gardner, Z., Mooney, P., De Sabbata, S., Dowthwaite, L., 2019. Quantifying gendered participation in OpenStreetMap: responding to theories of female (under) representation in crowdsourced mapping. GeoJournal. https://doi.org/10.1007/s10708-019-10035-z
[^4]: Collier, B., Bear, J., 2012. Conflict, criticism, or confidence: an empirical examination of the gender gap in wikipedia contributions, in: Proceedings of the ACM 2012 Conference on Computer Supported Cooperative Work, CSCW ’12. Association for Computing Machinery, Seattle, Washington, USA, pp. 383–392. https://doi.org/10.1145/2145204.2145265