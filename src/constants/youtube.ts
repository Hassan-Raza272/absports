/** Your cricket YouTube channel — only this source is used in the app */
export const YOUTUBE_CHANNEL = {
  handle: '@Uzairshafiqofficial',
  title: 'Uzairshafiqofficial',
  channelUrl: 'https://www.youtube.com/@Uzairshafiqofficial',
  videosUrl: 'https://www.youtube.com/@Uzairshafiqofficial/videos',
  /** Mobile Videos tab — scraped in-app so we only get YOUR uploads */
  mobileVideosUrl: 'https://m.youtube.com/@Uzairshafiqofficial/videos',
  /** Live / streams tab */
  streamsUrl: 'https://m.youtube.com/@Uzairshafiqofficial/streams',
  /** Confirmed upload from your channel */
  sampleVideoId: 'y3w3pVs6ceQ',
} as const;

/**
 * Your live stream videos (YouTube live IDs).
 * Add more IDs here when you go live again.
 * Example: https://www.youtube.com/live/LQUYC893aP4 → id LQUYC893aP4
 */
export const YOUTUBE_LIVE_VIDEOS: { id: string; title?: string }[] = [
  { id: 'LQUYC893aP4', title: 'Live cricket stream' },
];

/**
 * Android applicationId — YouTube Error 153 requires HTTP Referer like https://{appId}
 * @see https://developers.google.com/youtube/terms/required-minimum-functionality
 */
export const YOUTUBE_EMBED_REFERER = 'https://com.absscore';

export type ChannelVideo = {
  id: string;
  title: string;
  publishedAt?: string;
  views?: string;
  duration?: string;
  isLive?: boolean;
  /** Official YouTube CDN thumbnail URL (never generated locally) */
  thumbnail: string;
  watchUrl: string;
};

/** Official YouTube thumbnail CDN for a video id */
export function youtubeOfficialThumb(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(videoId: string) {
  return (
    `https://www.youtube.com/embed/${videoId}` +
    `?playsinline=1&rel=0&modestbranding=1&controls=1&autoplay=1&fs=1`
  );
}

export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeLiveUrl(videoId: string) {
  return `https://www.youtube.com/live/${videoId}`;
}

export function youtubeAppUrl(videoId: string) {
  return `vnd.youtube:${videoId}`;
}

export function liveVideosSeed(): ChannelVideo[] {
  return YOUTUBE_LIVE_VIDEOS.map(item => ({
    id: item.id,
    title: item.title || 'Live stream',
    isLive: false,
    thumbnail: youtubeOfficialThumb(item.id),
    watchUrl: youtubeLiveUrl(item.id),
  }));
}

/** HTML player with referrer policy — fixes Error 153 in WebView */
export function youtubeEmbedHtml(videoId: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <meta name="referrer" content="strict-origin-when-cross-origin"/>
  <style>
    html, body { margin:0; padding:0; background:#000; height:100%; overflow:hidden; }
    iframe { border:0; width:100%; height:100%; display:block; }
  </style>
</head>
<body>
  <iframe
    src="${youtubeEmbedUrl(videoId)}"
    title="YouTube video"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    allowfullscreen
    playsinline
  ></iframe>
</body>
</html>`;
}
