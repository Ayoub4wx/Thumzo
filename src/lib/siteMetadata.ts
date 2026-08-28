export const SITE_NAME = "Thumora AI";
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://www.thumoraai.com").replace(/\/$/, "");
export const DEFAULT_OG_IMAGE = `${SITE_URL}/logos.png`;
export const DEFAULT_ROBOTS = "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

export const SOCIAL_PROFILES = [
  "https://www.youtube.com/@thumorai",
  "https://x.com/thumoraai",
  "https://www.instagram.com/thumoraai/",
  "https://www.tiktok.com/@thumoraai",
  "https://www.linkedin.com/company/thumora-ai/",
];

export function buildAbsoluteUrl(path = "/") {
  if (!path) {
    return SITE_URL;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
