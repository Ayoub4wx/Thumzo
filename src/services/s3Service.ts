import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.AWS_REGION || "eu-west-1";
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "thumbnail";
const S3_ENDPOINT = "https://fncjyuuxqpnydgnugmqz.storage.supabase.co/storage/v1/s3";

console.log(`[S3 Service] Initializing with Supabase Endpoint: ${S3_ENDPOINT}, Region: ${REGION}, Bucket: ${BUCKET_NAME}`);

const s3Client = new S3Client({
  region: REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true, // Required for Supabase S3
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function debugBuckets() {
  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    const bucketNames = (response.Buckets || []).map(b => b.Name);
    console.log(`[S3 Debug] Available Buckets: ${bucketNames.join(", ")}`);
    return bucketNames;
  } catch (err) {
    console.error(`[S3 Debug] Failed to list buckets:`, err);
    return [];
  }
}

export async function listTemplates() {
  const bucket = process.env.AWS_BUCKET_NAME || "thumbnail";
  if (!bucket) throw new Error("AWS_BUCKET_NAME is not configured");

  try {
    console.log(`[S3 Service] Listing objects in bucket: ${bucket}`);
    
    // Try listing without prefix to find any images in the bucket
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      // Prefix: "thumbnails/", // Removed strict prefix to find existing images
    });

    const response = await s3Client.send(command);
    
    const publicBaseUrl = S3_ENDPOINT.replace("/s3", "/object/public");

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.jfif'];

    return (response.Contents || [])
      .filter(item => {
        if (!item.Key) return false;
        const lowerKey = item.Key.toLowerCase();
        return imageExtensions.some(ext => lowerKey.endsWith(ext));
      })
      .map(item => ({
        key: item.Key,
        url: `${publicBaseUrl}/${bucket}/${item.Key}`,
        lastModified: item.LastModified,
      }));
  } catch (error: any) {
    if (error.name === "NoSuchBucket") {
      console.error(`[S3 Error] Bucket "${bucket}" not found. Please check your Supabase storage bucket name.`);
      await debugBuckets();
    }
    console.error(`[S3 Error] Failed to list templates:`, error);
    throw error;
  }
}

export async function uploadImageToS3(base64Data: string, fileName: string) {
  if (!BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured");

  try {
    // Remove base64 prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Image, "base64");

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `thumbnails/${fileName}`,
      Body: buffer,
      ContentType: "image/png",
    });

    await s3Client.send(command);
    
    const publicBaseUrl = S3_ENDPOINT.replace("/s3", "/object/public");
    return `${publicBaseUrl}/${BUCKET_NAME}/thumbnails/${fileName}`;
  } catch (error: any) {
    console.error(`[S3 Error] Failed to upload image:`, error);
    throw error;
  }
}

export async function getSignedDownloadUrl(fileName: string) {
  if (!BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured");

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `thumbnails/${fileName}`,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
