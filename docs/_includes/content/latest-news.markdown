#### [Latest News]({{ site.baseurl }}/blog/)

{% for post in site.posts limit:{{site.latest-news-pages}} %}* [{{ post.title }}]({{ site.baseurl }}{{ post.url }})
{% endfor %}
