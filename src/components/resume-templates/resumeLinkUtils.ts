const MAX_URL_DISPLAY_LENGTH = 40;

export function displayUrl(url: string, label?: string | null): string {
  if (label && label.trim()) return label.trim();
  return displayProfileUrl(url);
}

export function displayProfileUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('mailto:')) return url.replace('mailto:', '');

  let clean = url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');

  if (clean.length > MAX_URL_DISPLAY_LENGTH) {
    const parts = clean.split('/');
    const short = parts.slice(0, 3).join('/');
    clean = short.length < clean.length ? `${short}/...` : `${clean.substring(0, MAX_URL_DISPLAY_LENGTH)}...`;
  }

  return clean;
}

export function normalizeHref(url: string): string {
  if (!url) return '#';
  if (url.startsWith('mailto:') || url.startsWith('http')) return url;
  return `https://${url}`;
}
