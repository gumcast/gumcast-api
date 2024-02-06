# Podcast Feeds for Gumroad

Podcast feeds are RSS feeds with a few specific fields used by podcast apps.

In the context of Gumroad, their primary requirements are:

- An RSS feed representing the product and its files, typically in reverse chronological order.
- Stable feed URL
- Stable file attachment URLs
- Routes support GET and HEAD requests

For a product like Gumroad, adding private RSS feeds to individual product purchases that contain podcast compatible media makes sense, because it provides another way for customers to consume their media with software that provides episodic playback as well as playback state syncing between devices.

To add this feature you need to add at least two API routes: one that generates the product RSS feed, and the other that redirects to the media content, plus any other routes related to how the feeds are generated and administered. Additionally, the feeds need to be exposed somewhere in the UI of the product page when purchased.
Additional options and settings could also be added for product authors to configure (like feed order, or file limit).

## The RSS Feed Route

The feed route should provide a unique feed URL to each customer that has bought the product.

In a first party RSS implementation in Gumroad, it would likely be easier to create a `feed_token` stored in the database the first time the user requests a podcast feed for one of their purchases. The feed token should be used only for access to an RSS feed or to resolve its media URLs.
The feed token should inherent the subscription status of the purchaseID, so that the feed and file URLs stop working if the users subscription ends (resulting in a 403 http error or empty RSS feed). If the subscription is resumed, ideally the feed would begin working again.

The RSS feed should include a list of podcast compatible files in chronological order (or be customizable by the product author).

### How Gumcast handles the feed route

Gumcast generates RSS feed URLs that look like this:

```
https://api.gumcast.com/feed.rss?purchase_id=1234qwer&access_token=1234qwer
```

Where `purchase_id` points to the users product purchase and `access_token` is an oauth content api token.
When a GET or HEAD request is sent to this URL, Gumcast makes a request to the Gumroad content API and generates an RSS feed that looks like this:

```xml
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <atom:link href="https://api.gumcast.com/feed.rss?access_token=1234qwer&amp;purchase_id=1234qwer" rel="self" type="application/rss+xml"/>
    <title>Product Name Goes here</title>
    <link>https://gumroad.com/l/1234</link>
    <description>Product description goes here</description>
    <language>en-us</language>
    <copyright>© 2024 Copyright owner</copyright>
    <pubDate>Tue, 04 Oct 2022 09:23:27 GMT</pubDate>
    <generator>jsonfeed-to-rss 3.0.7 (https://github.com/bcomnes/jsonfeed-to-rss#readme)</generator>
    <docs>http://www.rssboard.org/rss-specification</docs>
    <image>
      <url>https://public-files.gumroad.com/1234qwer</url>
      <link>https://gumroad.com/l/1234</link>
      <title>Image Title Goes Here</title>
    </image>
    <itunes:author>Product Author</itunes:author>
    <itunes:summary>Description also goes here</itunes:summary>
    <itunes:subtitle>A product subtitle can go here</itunes:subtitle>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>Product Author</itunes:name>
    </itunes:owner>
    <itunes:image href="https://public-files.gumroad.com/1234"/>
    <itunes:block>Yes</itunes:block>
    <item>
      <title>File Title or Name</title>
      <dc:creator>Product Author</dc:creator>
      <description>File description</description>
      <guid isPermaLink="false">fileID</guid>
      <pubDate>Tue, 04 Oct 2022 09:23:27 GMT</pubDate>
      <enclosure type="audio/mpeg " url="https://api.gumcast.com/file/filename.mp3?purchase_id=1234&amp;access_token=1234&amp;file_id=1234" length="40661826"/>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:title>File Title or Name</itunes:title>
      <itunes:author>Product Author</itunes:author>
      <itunes:episode>2</itunes:episode>
      <itunes:subtitle>Subtitle goes here</itunes:subtitle>
      <itunes:summary>Summary goes here</itunes:summary>
      <itunes:image href="https://public-files.gumroad.com/1234"/>
    </item>
    <item>
      <title>File Title or Name</title>
      <dc:creator>Product Author</dc:creator>
      <description>File description</description>
      <guid isPermaLink="false">fileID</guid>
      <pubDate>Tue, 04 Oct 2022 09:23:27 GMT</pubDate>
      <enclosure type="audio/mpeg " url="https://api.gumcast.com/file/filename.mp3?purchase_id=1234&amp;access_token=1234&amp;file_id=1234" length="40661826"/>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:title>File Title or Name</itunes:title>
      <itunes:author>Product Author</itunes:author>
      <itunes:episode>1</itunes:episode>
      <itunes:subtitle>Subtitle goes here</itunes:subtitle>
      <itunes:summary>Summary goes here</itunes:summary>
      <itunes:image href="https://public-files.gumroad.com/1234"/>
    </item>
  </channel>
</rss>
```

For more info on RSS and the itunes podcast extensions, see here:

- https://github.com/bcomnes/jsonfeed-to-rss?tab=readme-ov-file#more-itunes-rss-feed-information

Gumcast generates RSS feeds by transforming a [JSONFeed](https://www.jsonfeed.org/) into RSS. This is just an implementation detail and isn't a fundamental requirement for this feature.

### Gumroad Native Feeds

If Gumroad were to implement native RSS feeds, it might make more sense to generate a unique `feed_token` that is tied to an individual `purchase_id`, with the resulting feed URL looking something like this:

- `https://gumroad.com/api/feed/[product_id]/[feed_token]`
- `https://gumroad.com/api/feed/?product_id=[product_id]&feed_token=[feed_token]`
- `https://user:[feed_token]@gumroad.com/api/feed/[product_id]

An option to generate a feed URL would appear automatically on all products that contain podcast safe files.
`feed_token`'s could also be used with the file URLs.

Feed tokens act similar to a oauth `Bearer` token in this context, but are only used to access RSS feeds and files in those feeds.

## The File Route

Podcasts refresh their feeds periodically. This can be between every 30 minutes to every 12 hours.
Gumroad media URLs are short lived.
To make it so the file URLs in the RSS feed don't expire after refreshing, Gumcast inserts proxy URLs into the RSS feed that are used to redirect podcast clients to these short lived media URLs, even if they haven't refreshed their feeds in a long time.

In Gumcast these file URLS look like this:

```
https://api.gumcast.com/file/filename.mp3?purchase_id=1234&access_token=1234&file_id=1234
```

When a request for a file comes in, Gumcast uses the oauth `access_token` to fetch the specific product, and then locates the `file_id`.
Once the file is located, Gumcast resolves the `file.download_url` redirect chain to its final, short lived media URL.
Once this short lived media URL is resolved, Gumcast redirects the podcast client to it with an http 302 redirect response.
It is important to cache this short lived media URL because its slow to generate and is subject to rate limiting.

### Gumroad native RSS file route

If Gumroad were to implement this route, it could re-use the `feed_token` concept described above with the addition of a `file_id`.

- `https://gumroad.com/api/feed/[feed_token]/[file_id]`

This route would resolve the final short lived media URL in a similar fashion to `file.download_url` does now, and use the 302 redirect technique to forward podcast clients to it.

## Valid podcast File Types

Podcast apps support both video and audio files so long as they can be downloaded as a single blob. Http range requests are also used to support streaming playback and seek. Streamable media, like HLS and `.m3u8` playlists have extremely buggy/limited support in podcast apps, and should probably not be included as items in the RSS feeds.

Common file formats to support:

- `mp3`
- `mp4`
- `m4a`

## Feed sharing mitigation

Feed sharing, like password sharing, is an issue that requires some basic mitigations.
Here are effective strategies for mitigating feed sharing issues:

### Rollable feed tokens

The unique `feed_token` used to access the podcast RSS feeds and files should be rollable, either by customer support or the user. When a feed token is rolled, it should invalidate all prior active subscriptions to the previous feed URL and token by changing or marking that token as inactive.

Gumcast implements a banned oauth token list to mitigate RSS feeds that have been shared publicly.
Gumroad could simply change the `feed_token`, or create a new one and mark the old one as invalid.

### Per feed rate limiting

Adding rate limiting to the RSS feeds and file URLs helps mitigate feed sharing.
When a feed is shared, it shows characteristic traffic of many users polling the feed and downloading files at an unusually high rates. By adding rate limiting to the feed and file routes you can discourage feed sharing by causing shared feeds to become inoperable and unreliable.
To effectively implement this, add rate limiting to feed and file routes that buckets according to `purchase_id` or `feed_token` rather than just IP address, since shared feeds will access from a wide range of IP addresses.

### Report feed functionality

Add a URL to the feed description that allows anyone who has access to the feed to visit that URL and "report" the feed.
When a feed is "reported", it invalidates the feed_token.
To reactivate the feed, the purchaser needs to re-log into their gumroad library and generate a new feed URL with a new token.
This allows content creators or community members who stumble across shared feeds to disable them in a self-serve manner.
Optionally track accounts that have reported feed URLs for further enforcement actions.
The presence of this feature also discourages sharing by simply being visible.
It is important that feed URLs contain a `product_id` in the URL, so it becomes possible to search for the feed pattern with search engines

