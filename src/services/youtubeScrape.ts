/**
 * Shared scrape for Videos / Streams tabs on @Uzairshafiqofficial.
 * messageType: 'channel-videos' | 'channel-streams'
 */
export function buildYouTubeScrapeJs(messageType: 'channel-videos' | 'channel-streams') {
  return `
(function () {
  function uniq(list) {
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var v = list[i];
      if (!v || !v.id || seen[v.id]) continue;
      seen[v.id] = 1;
      out.push(v);
    }
    return out;
  }

  function idFromHref(href) {
    if (!href) return null;
    var m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = href.match(/\\/live\\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = href.match(/\\/shorts\\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = href.match(/\\/embed\\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    return null;
  }

  function absUrl(u) {
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  }

  function scrape() {
    var found = [];
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href') || '';
      var id = idFromHref(href);
      if (!id) continue;

      var img = a.querySelector('img');
      var thumb = '';
      if (img) {
        thumb = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('data-src') || '';
        if ((!thumb || thumb.indexOf('data:') === 0) && img.srcset) {
          var parts = String(img.srcset).split(',');
          if (parts.length) {
            var last = parts[parts.length - 1].trim().split(' ')[0];
            if (last) thumb = last;
          }
        }
      }
      var official = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
      if (!thumb || thumb.indexOf('ytimg.com') === -1) thumb = official;
      else thumb = absUrl(thumb);

      var title = '';
      var aria = a.getAttribute('aria-label') || '';
      if (aria) title = aria.replace(/\\s+[0-9.:]+\\s*$/, '').trim();
      if (!title && img && img.alt) title = img.alt.trim();
      if (!title) {
        var tEl = a.querySelector('#video-title, .media-item-headline, h3, h4, span[class*="title"]');
        if (tEl && tEl.textContent) title = tEl.textContent.trim();
      }
      if (!title) title = 'YouTube video';

      var duration = '';
      var badge = a.querySelector('badge-shape, .badge, [class*="duration"], [class*="time"]');
      if (badge && badge.textContent) duration = badge.textContent.trim();

      var textBlob = ((a.textContent || '') + ' ' + aria + ' ' + duration).toLowerCase();
      var isLiveNow = textBlob.indexOf('watching') >= 0 || /\\blive\\b/.test(duration.toLowerCase());

      found.push({
        id: id,
        title: title,
        duration: duration || undefined,
        isLive: isLiveNow,
        thumbnail: thumb,
        watchUrl: 'https://www.youtube.com/watch?v=' + id
      });
    }

    var videos = uniq(found);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: '${messageType}',
        handle: '@Uzairshafiqofficial',
        count: videos.length,
        videos: videos
      }));
    }
  }

  scrape();
  setTimeout(function () { try { window.scrollTo(0, 1200); } catch (e) {} scrape(); }, 1500);
  setTimeout(function () { try { window.scrollTo(0, 2400); } catch (e) {} scrape(); }, 3500);
  setTimeout(function () { try { window.scrollTo(0, 4000); } catch (e) {} scrape(); }, 6000);
  setTimeout(function () { try { window.scrollTo(0, 6000); } catch (e) {} scrape(); }, 9000);
  setTimeout(function () { try { window.scrollTo(0, 9000); } catch (e) {} scrape(); }, 12000);
  true;
})();
`;
}

export const YOUTUBE_SCRAPE_JS = buildYouTubeScrapeJs('channel-videos');
export const YOUTUBE_STREAMS_SCRAPE_JS = buildYouTubeScrapeJs('channel-streams');
