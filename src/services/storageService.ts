import { supabase } from "../lib/supabase";

const PUBLIC_BUCKET = "thumbnails";
const USER_BUCKET = "user-assets";

export async function listTemplates() {
  try {
    const { data, error } = await supabase.storage.from(PUBLIC_BUCKET).list("", {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      console.error("Supabase storage list error:", error);
      throw error;
    }

    console.log("Raw files from Supabase bucket 'thumbnail':", data);

    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"];

    const filteredData = (data || []).filter((item) => {
      const lowerName = item.name.toLowerCase();
      // Ignore the default empty folder placeholder if it exists
      if (item.name === ".emptyFolderPlaceholder") return false;
      return imageExtensions.some((ext) => lowerName.endsWith(ext));
    });

    console.log("Filtered image files:", filteredData);

    return filteredData.map((item) => {
      const { data: { publicUrl } } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(item.name);
      return {
        key: item.name,
        url: publicUrl,
        lastModified: item.updated_at,
      };
    });
  } catch (error) {
    console.error("Failed to list templates:", error);
    throw error;
  }
}

export async function uploadUserImage(file: File | Blob, fileName: string, userId: string) {
  try {
    const filePath = `${userId}/${fileName}`;
    const { data, error } = await supabase.storage.from(USER_BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(USER_BUCKET).getPublicUrl(filePath);
    return publicUrl;
  } catch (error) {
    console.error("Failed to upload user image:", error);
    throw error;
  }
}

export async function uploadUserBase64Image(base64Data: string, fileName: string, userId: string) {
  try {
    // Remove base64 prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    
    // Convert base64 to Blob
    const byteCharacters = atob(base64Image);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
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
