# Dynamic Sidebar Setup Guide

Your Jekyll site now has a dynamic sidebar that automatically populates based on post categories!

## What Was Added

### 1. Files Created/Modified

- **`_includes/sidebar.html`** - The sidebar component that displays categories and recent posts
- **`_includes/head.html`** - Custom head to include the sidebar CSS
- **`_includes/header.html`** - Custom header using Minima theme structure
- **`_includes/nav-items.html`** - Navigation items component
- **`_layouts/default.html`** - Custom default layout that includes the sidebar
- **`_layouts/home.html`** - Custom home layout with sidebar
- **`_layouts/category.html`** - Template for category archive pages
- **`assets/css/sidebar.css`** - Styling for the sidebar (responsive & dark mode ready)

### 2. Configuration Updates

- Added `jekyll-seo-tag` and `jekyll-archives` plugins to `Gemfile` and `_config.yml`
- Configured `minima.nav_pages` to control which pages appear in the header navigation

## How to Use

### Adding Categories to Posts

In your post's front matter, add categories like this:

```yaml
---
layout: post
title: "My Post Title"
date: 2023-06-30
categories: thoughts technical tutorials
---
```

You can have multiple categories separated by spaces.

### Category Pages are Automatic!

Thanks to the `jekyll-archives` plugin, category pages are **automatically generated** for you. No need to create individual pages for each category - just add categories to your posts and the plugin creates the archive pages automatically at `/:category/` (e.g., `/thoughts/`, `/tutorials/`).

### Sidebar Features

The sidebar includes two sections:

1. **Categories** - Lists all categories with post counts, links to category pages
2. **Recent Posts** - Shows the 5 most recent posts across all categories

### Customizing the Sidebar

Edit `_includes/sidebar.html` to:
- Change the number of recent posts (default: 5)
- Add/remove sections
- Modify the display format
- Add custom content

### Styling

The sidebar styles are in `assets/css/sidebar.css`. Key features:
- **Sticky positioning** - Sidebar stays visible while scrolling
- **Responsive** - Stacks vertically on mobile (<800px width)
- **Dark mode** - Automatically adapts to system theme
- **Minima theme integration** - Uses Minima CSS variables

### Removing the Sidebar

If you want some pages without the sidebar, create an alternative layout:

**`_layouts/page.html`**

```html
---
layout: default
---

<article class="post">
  <header class="post-header">
    <h1 class="post-title">{{ page.title | escape }}</h1>
  </header>

  <div class="post-content">
    {{ content }}
  </div>
</article>
```

Then use `layout: page` in the front matter of pages that shouldn't have a sidebar.

## Installation Steps

1. **Install the gem dependencies:**

```bash
cd site
bundle install
```

2. **Build and serve the site:**

```bash
bundle exec jekyll serve
```

3. **View your site:**

Open `http://localhost:4000` in your browser

## Controlling Header Navigation

To control which pages appear in the header navigation, edit the `minima.nav_pages` setting in `_config.yml`:

```yaml
minima:
  skin: auto
  nav_pages:
    - about.markdown
    - cv.markdown
```

This ensures that only your specified pages appear in the header, while the auto-generated category pages are excluded.

## Testing

- Add a new post with different categories
- Verify the sidebar updates automatically
- Test responsive layout by resizing your browser
- Check dark mode if your system supports it

## Troubleshooting

**Sidebar not showing?**
- Make sure you've run `bundle install`
- Check that `sidebar.css` is being loaded (view page source)
- Verify the layout is set to `default` in your pages

**Category links not working?**
- Create a corresponding category page (e.g., `tutorials.markdown`)
- Ensure the `category` field matches your post categories exactly

**Styling issues?**
- Clear Jekyll cache: `bundle exec jekyll clean`
- Rebuild: `bundle exec jekyll build`

## Advanced Customization

### Hiding Sidebar on Specific Pages

Add this to your page's front matter:

```yaml
---
layout: default
hide_sidebar: true
---
```

Then modify `_layouts/default.html`:

```html
{% if page.hide_sidebar %}
  <div class="main-content">
    {{ content }}
  </div>
{% else %}
  <div class="content-with-sidebar">
    {%- include sidebar.html -%}
    <div class="main-content">
      {{ content }}
    </div>
  </div>
{% endif %}
```

### Adding Tag Clouds

You can extend the sidebar to show tags as well by adding a similar block to `sidebar.html`:

```html
<div class="sidebar-section">
  <h3>Tags</h3>
  {% assign tags = site.tags | sort %}
  <div class="tag-cloud">
    {% for tag in tags %}
      <a href="/tags/{{ tag[0] | slugify }}/" class="tag">
        {{ tag[0] }}
      </a>
    {% endfor %}
  </div>
</div>
```

## Questions?

The sidebar system is fully functional and ready to use. Just add categories to your posts and they'll automatically appear in the sidebar!

