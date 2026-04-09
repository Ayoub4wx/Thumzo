import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const REGION = process.env.AWS_REGION || "eu-west-1";
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "thumbnail";
const S3_ENDPOINT = "https://fncjyuuxqpnydgnugmqz.storage.supabase.co/storage/v1/s3";

const s3Client = new S3Client({
  region: REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  const command = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
  const response = await s3Client.send(command);
  const publicBaseUrl = S3_ENDPOINT.replace("/s3", "/object/public");
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.jfif'];
  
  const items = (response.Contents || [])
    .filter(item => {
      if (!item.Key) return false;
      const lowerKey = item.Key.toLowerCase();
      return imageExtensions.some(ext => lowerKey.endsWith(ext));
    })
    .map(item => ({
      key: item.Key,
      url: `${publicBaseUrl}/${BUCKET_NAME}/${item.Key}`,
    }));

  console.log(`Found ${items.length} items`);
  
  const results: Record<string, string> = {};
  
  for (const item of items) {
    try {
      console.log(`Fetching ${item.url}`);
      const res = await fetch(item.url);
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [
            { text: "Analyze this YouTube thumbnail image and generate a catchy, clickbait-style YouTube video title for it. Return ONLY the title text, nothing else. No quotes." },
            { inlineData: { mimeType: 'image/jpeg', data: base64 } }
          ]}
        ]
      });
      
      const title = aiResponse.text?.trim() || "Untitled";
      console.log(`Title for ${item.key}: ${title}`);
      results[item.key] = title;
    } catch (e: any) {
      console.error(`Error processing ${item.key}:`, e.message);
    }
  }
  
  console.log("FINAL_RESULTS_JSON=" + JSON.stringify(results));
}

run();
