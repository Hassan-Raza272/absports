import {
  ChannelVideo,
  YOUTUBE_CHANNEL,
  youtubeOfficialThumb,
  youtubeWatchUrl,
} from '../constants/youtube';

/** Fill missing titles / confirm thumbnails via official YouTube oEmbed (no API key). */
export async function enrichVideosWithOEmbed(videos: ChannelVideo[]): Promise<ChannelVideo[]> {
  const enriched = await Promise.all(
    videos.map(async video => {
      const needsTitle = !video.title || video.title === 'YouTube video';
      if (!needsTitle && video.thumbnail?.includes('ytimg.com')) {
        return video;
      }
      try {
        const url =
          `https://www.youtube.com/oembed?format=json&url=` +
          encodeURIComponent(youtubeWatchUrl(video.id));
        const res = await fetch(url);
        if (!res.ok) return video;
        const data = await res.json();
        return {
          ...video,
          title: String(data.title || video.title || 'YouTube video'),
          thumbnail: String(data.thumbnail_url || video.thumbnail || youtubeOfficialThumb(video.id)),
        };
      } catch {
        return {
          ...video,
          thumbnail: video.thumbnail || youtubeOfficialThumb(video.id),
        };
      }
    }),
  );
  return enriched;
}

/** Ensure your known sample video is present if scrape missed it. */
export function ensureSampleVideo(videos: ChannelVideo[]): ChannelVideo[] {
  const id = YOUTUBE_CHANNEL.sampleVideoId;
  if (videos.some(v => v.id === id)) return videos;
  return [
    {
      id,
      title: 'YouTube video',
      thumbnail: youtubeOfficialThumb(id),
      watchUrl: youtubeWatchUrl(id),
    },
    ...videos,
  ];
}
