import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is not set in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testApi() {
  console.log("Testing Gemini API with key:", apiKey.substring(0, 10) + "...");
  
  try {
    const actualModelId = "gemini-1.5-flash-latest"; // or gemini-1.5-flash
    
    // Simple text-only test first to verify key
    console.log("Starting text-only test with model:", actualModelId);
    const result = await ai.models.generateContent({
      model: actualModelId,
      contents: {
        parts: [
          { text: "Hello, are you working? Respond with 'Yes' if so." }
        ]
      }
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log("✅ API is working! Response:", text);
  } catch (error: any) {
    console.error("❌ API Test Failed:");
    if (error.message) console.error("Message:", error.message);
    process.exit(1);
  }
}

testApi();
