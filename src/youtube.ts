const VIDEO_ID_PATTERNS: RegExp[] = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/live\/)([\w-]{11})/,
];

export function parseVideoId(input: string): string {
  const trimmed = input.trim();

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new Error(
    `YouTubeの動画URLまたは動画IDとして認識できませんでした: "${input}"`,
  );
}

export function toWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
