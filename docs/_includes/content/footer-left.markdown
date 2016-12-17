{% if site.copyright-message %}* {{ site.copyright-message }}{% endif %}
* [![RSS]({{ site.baseurl }}/assets/images/feed-20.png)]({{ site.baseurl }}/feed.xml)
{% if site.facebook-url %}* <div class="fb-like" data-href="{{ site.facebook-url }}" data-layout="button" data-action="like" data-show-faces="false" data-share="false"></div>{% endif %}
{% if site.twitter-url %}* <a class="twitter-follow-button"
  href="{{ site.twitter-url }}" data-show-count="false" data-show-screen-name="false">
Follow</a>{% endif %}
