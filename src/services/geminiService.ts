import { GoogleGenAI, Type } from "@google/genai";

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
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  if (!apiKey) {
    throw new Error("Gemini API Key is missing.");
  }

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    const blob = await imageResponse.blob();
    const buffer = await blob.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: blob.type,
              data: base64Data,
            },
          },
          {
            text: "Analyze this YouTube thumbnail. Extract its style, color palette, composition, and key visual elements. Return a JSON object that can be used to recreate this style. The JSON should include 'color_palette' (array of hex), 'composition' (string), 'lighting' (string), and 'vibe' (string).",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            color_palette: { type: Type.ARRAY, items: { type: Type.STRING } },
            composition: { type: Type.STRING },
            lighting: { type: Type.STRING },
            vibe: { type: Type.STRING },
          },
          required: ["color_palette", "composition", "lighting", "vibe"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Image Analysis Error:", error);
    return null;
  }
}

export async function generateThumbnails(options: GenerationOptions) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });

  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please configure it in the secrets panel.");
  }

  try {
    let modelId = "gemini-2.5-flash-image";
    if (options.model?.includes("3.1")) {
      modelId = "gemini-3.1-flash-image-preview";
    } else if (options.model?.includes("Pro")) {
      modelId = "gemini-3-pro-image-preview";
    }
    
    let finalPrompt = `Create a high-quality YouTube thumbnail for: ${options.prompt}.`;
    
    if (options.instructions) {
      finalPrompt += `\n\nAdditional Instructions: ${options.instructions}`;
    }
    
    if (options.styleJson) {
      finalPrompt += `\n\nFollow this style configuration (JSON): ${options.styleJson}`;
    }

    finalPrompt += `\n\nStyle: Professional, vibrant, high contrast, engaging, viral YouTube style.`;

    const parts: any[] = [];

    if (options.baseImage) {
      try {
        const base64Data = options.baseImage.split(',')[1];
        const mimeType = options.baseImage.split(';')[0].split(':')[1] || 'image/png';
        parts.push({
          inlineData: { data: base64Data, mimeType }
        });
      } catch (e) {
        console.warn("Failed to parse baseImage", e);
      }
    }

    if (options.referenceImage) {
      try {
        const base64Data = options.referenceImage.split(',')[1];
        const mimeType = options.referenceImage.split(';')[0].split(':')[1] || 'image/png';
        parts.push({
          inlineData: { data: base64Data, mimeType }
        });
        finalPrompt += "\n\nUse the second provided image as a reference for the subject/person to insert into the scene.";
      } catch (e) {
        console.warn("Failed to parse referenceImage", e);
      }
    }

    parts.push({ text: finalPrompt });

    const imageConfig: any = {
      aspectRatio: options.aspectRatio,
    };

    if (modelId !== "gemini-2.5-flash-image") {
      imageConfig.imageSize = options.imageSize;
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        imageConfig,
      },
    });

    const images: string[] = [];
    
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          images.push(`data:image/png;base64,${base64Data}`);
        }
      }
    }

    if (images.length === 0) {
      throw new Error("No images were generated. Please try a different prompt.");
    }

    return images;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}
