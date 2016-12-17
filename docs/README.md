# GitHub Wiki-like Jekyll Theme

This Jekyll theme is inspired by the GitHub Wiki look, and is intended as an easy migration path from Wikis to Pages.

## Pages vs. posts

The theme allows to define both pages and posts.

Pages can have any URLs, preferably organised hierarchicaly (like `/debug/openocd/` and `/debug/jlink/`).

Posts are special cases, since their chronological order is important, and usually have a special URL, which include the date (`/blog/:year/:month/:day/:title/` in this configuration).

## Local build vs. GitHub Pages build

As usual, local builds provide some extra functionality, by allowing to use plug-ins which are otherwise not available in GitHub Pages.

One such plug-in is `jekyll-last-modified-at` which automates the maintenance of the pages/posts dates.

## last_modified_at:

When building the site locally, the page/post date is computed automatically by the plug-in, using the Git commit date. The `last_modified_at:` definition in the YAML header is ignored.

When the site is build by GitHub Pages, you need to manually add the `last_modified_at:` definition in the YAML headers, otherwise the `sitemap.xml` file will not include dates, and web robots (like Google) will have a harder life to index the site.

## Content & customisations

### Pages

Add more pages in the `pages` folder, preferably grouped in folders that will reflect the final URL structure.

### Posts

Add more posts in the `_posts` folder; create new subfolders (subfolder names are not used for categories; however, if `_posts` folder are used inside inner folders, those are used as categories).

### Sidebar

Edit the `_includes/content/sidebar.markdown` file to change the content of the right sidebar.

### Site left & right footers

The items to be displayed in the site footer are defined in `_includes/content/footer-left.markdown` and `_includes/content/footer-right.markdown`.

### Custom page footers

Pages (not posts) can have different custom footers. You can define a site custom footer that will be used for all pages that have no separate footer.

The site custom footer is enabled in `_config.yml`:

```
custom-footer-content: content/site-custom-footer.markdown
```

To add a page custom footer, create the footer file (like `_test-footer.md`) and refer to it in the page YAML section:

```
custom-footer-content: _test-footer.md
```

> Note: the footer file name should start with an underscore, to make Jekyll not copy it to the output site.

## Paginator

Although the pagination code is in, and functional, the Paginator plug-in is marked as _retired_ in Jekyll 3, so use it with caution.

## Possible CSS issues

Web design is not my main field of expertise, so you might encounter some issues with the CSS files. Please suggest fixes, and I'll do my best to incorporate them.

Enjoy,

Liviu Ionescu
