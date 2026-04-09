import { supabase } from "../lib/supabase";

const BUCKET_NAME = "thumbnail";

export async function listTemplates() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list("", {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;

    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".jfif"];

    return (data || [])
      .filter((item) => {
        const lowerName = item.name.toLowerCase();
        return imageExtensions.some((ext) => lowerName.endsWith(ext));
      })
      .map((item) => {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(item.name);
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

export async function uploadImage(file: File | Blob, fileName: string) {
  try {
    const filePath = `thumbnails/${fileName}`;
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return publicUrl;
  } catch (error) {
    console.error("Failed to upload image:", error);
    throw error;
  }
}

export async function uploadBase64Image(base64Data: string, fileName: string) {
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

    return await uploadImage(blob, fileName);
  } catch (error) {
    console.error("Failed to upload base64 image:", error);
    throw error;
  }
}

export async function getDownloadUrl(fileName: string) {
  try {
    const filePath = `thumbnails/${fileName}`;
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(filePath, 3600);
    
    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error("Failed to get download URL:", error);
    throw error;
  }
}
