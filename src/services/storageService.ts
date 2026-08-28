import { supabase } from "../lib/supabase";
import {
  normalizeTemplateCategory,
  type TemplateCategory,
} from "../lib/studioMetadata";

const PUBLIC_BUCKET = "thumbnails";
const USER_BUCKET = "user-assets";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type ImageResizeMode = "cover" | "contain" | "fill";

export interface ImagePreviewOptions {
  width?: number;
  height?: number;
  quality?: number;
  resize?: ImageResizeMode;
  expiresIn?: number;
}

const signedPreviewUrlCache = new Map<string, { url: string; expiresAt: number }>();

export interface TemplateAsset {
  id: string;
  url: string;
  title: string;
  category: TemplateCategory;
  isNew: boolean;
  isTrending: boolean;
  isPopular: boolean;
  type: string;
  lastModified: string;
  tags?: string[];
}

function normalizeTemplateTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function getPublicTemplatePath(value: string) {
  return extractStoragePathFromUrl(value, PUBLIC_BUCKET);
}

function isTemplateRecordAllowed(imageUrl: unknown) {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    return false;
  }

  const publicPath = getPublicTemplatePath(imageUrl);

  if (publicPath?.toLowerCase().startsWith("avatars/")) {
    return false;
  }

  return true;
}

export async function listTemplates(): Promise<TemplateAsset[]> {
  try {
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data
      .filter((item) => isTemplateRecordAllowed(item.image_url))
      .map((item) => ({
        id: item.id,
        url: item.image_url,
        title: item.title,
        category: normalizeTemplateCategory(item.category),
        isNew: item.is_new ?? true,
        isTrending: item.is_trending ?? false,
        isPopular: item.is_popular ?? false,
        type: "image/jpeg", // default for thumbnails
        lastModified: item.updated_at || item.created_at,
        tags: normalizeTemplateTags(item.tags),
      }));
  } catch (error) {
    console.error("Failed to list templates:", error);
    throw error;
  }
}

function extractStoragePathFromUrl(value: string, bucket: string) {
  if (!value) {
    return null;
  }

  const bucketMarkers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/render/image/public/${bucket}/`,
    `/storage/v1/render/image/sign/${bucket}/`,
    `/storage/v1/render/image/authenticated/${bucket}/`,
  ];

  try {
    const parsed = new URL(value);
    const matchedMarker = bucketMarkers.find((marker) => parsed.pathname.includes(marker));

    if (!matchedMarker) {
      return null;
    }

    const encodedPath = parsed.pathname.split(matchedMarker)[1];
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

function normalizeDimension(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(1, Math.round(value as number));
}

function normalizeQuality(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(100, Math.max(20, Math.round(value as number)));
}

function getImageTransform(options: ImagePreviewOptions = {}) {
  const width = normalizeDimension(options.width);
  const height = normalizeDimension(options.height);
  const quality = normalizeQuality(options.quality);

  if (!width && !height && !quality && !options.resize) {
    return undefined;
  }

  return {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(quality ? { quality } : {}),
    ...(options.resize ? { resize: options.resize } : {}),
  };
}

function getSignedPreviewCacheKey(filePath: string, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS) {
  return JSON.stringify({
    filePath,
    expiresIn,
  });
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

export function getPublicImagePreviewUrl(
  imageUrl: string,
  options: ImagePreviewOptions = {},
  bucket = PUBLIC_BUCKET
) {
  // Signed transform URLs have been returning broken image responses for project cards in this app,
  // so we skip the /render/image URL generation.
  // If the URL is already a full URL, we return it as is.
  // If it's a relative path, we generate the basic public object URL.
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(imageUrl);
  
  return publicUrl;
}

export function getUserAssetPath(assetReference: string, userId?: string) {
  const parsedUrlPath = extractStoragePathFromUrl(assetReference, USER_BUCKET);

  if (parsedUrlPath) {
    return parsedUrlPath;
  }

  if (!assetReference.includes("://") && (!userId || assetReference.startsWith(`${userId}/`))) {
    return assetReference;
  }

  return null;
}

export async function downloadFileFromUrl(url: string, fileName: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to download the selected file.");
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, fileName);
}

export async function uploadUserImage(file: File | Blob, fileName: string, userId: string) {
  try {
    const filePath = `${userId}/${fileName}`;
    const { error } = await supabase.storage.from(USER_BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw error;
    return filePath;
  } catch (error) {
    console.error("Failed to upload user image:", error);
    throw error;
  }
}

export async function uploadUserAvatar(file: File | Blob, fileName: string, userId: string) {
  try {
    const filePath = `avatars/${userId}/${fileName}`;
    const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Failed to upload user avatar:", error);
    throw error;
  }
}

export async function uploadUserBase64Image(base64Data: string, fileName: string, userId: string) {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const byteCharacters = atob(base64Image);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "image/png" });

    return await uploadUserImage(blob, fileName, userId);
  } catch (error) {
    console.error("Failed to upload user base64 image:", error);
    throw error;
  }
}

export async function getDownloadUrl(fileName: string, userId: string) {
  try {
    const filePath = `${userId}/${fileName}`;
    const { data, error } = await supabase.storage.from(USER_BUCKET).createSignedUrl(filePath, 3600);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error("Failed to get download URL:", error);
    throw error;
  }
}

export async function getUserAssetPreviewUrl(
  assetReference: string,
  userId?: string,
  options: ImagePreviewOptions = {}
) {
  try {
    const filePath = getUserAssetPath(assetReference, userId);

    if (!filePath) {
      return assetReference;
    }

    const expiresIn = options.expiresIn || DEFAULT_SIGNED_URL_TTL_SECONDS;
    const cacheKey = getSignedPreviewCacheKey(filePath, expiresIn);
    const cachedUrl = signedPreviewUrlCache.get(cacheKey);

    if (cachedUrl && cachedUrl.expiresAt > Date.now()) {
      return cachedUrl.url;
    }

    // Keep private previews on plain signed object URLs. Signed transform URLs have
    // been returning broken image responses for project cards in this app.
    const { data, error } = await supabase.storage.from(USER_BUCKET).createSignedUrl(filePath, expiresIn);

    if (error) throw error;

    signedPreviewUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + expiresIn * 1000 - SIGNED_URL_REFRESH_BUFFER_MS,
    });

    return data.signedUrl;
  } catch (error) {
    console.error("Failed to get user asset preview URL:", error);
    return assetReference;
  }
}

export async function deleteUserAsset(assetReference: string, userId?: string) {
  try {
    const filePath = getUserAssetPath(assetReference, userId);

    if (!filePath) {
      return false;
    }

    const { error } = await supabase.storage.from(USER_BUCKET).remove([filePath]);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Failed to delete user asset from storage:", error);
    throw error;
  }
}
