export interface GenerationOptions {
  prompt: string;
  imageSize: "1K" | "2K" | "4K";
  aspectRatio: "16:9" | "9:16" | "1:1";
  instructions?: string;
  styleJson?: string;
  model?: string;
  baseImage?: string;
  referenceImage?: string;
}

export async function analyzeImage(imageUrl: string) {
  try {
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to analyze image");
    }

    return await response.json();
  } catch (error) {
    console.error("Image Analysis Error:", error);
    return null;
  }
}

export async function generateThumbnails(options: GenerationOptions) {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to generate thumbnails");
    }

    const data = await response.json();
    return data.images;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
