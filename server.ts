import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { uploadImageToS3, listTemplates } from "./src/services/s3Service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Thumio AR API is running" });
  });

  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await listTemplates();
      res.json(templates);
    } catch (error) {
      console.error("S3 List Error:", error);
      res.status(500).json({ error: "Failed to list templates" });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const { image, fileName } = req.body;
      if (!image || !fileName) {
        return res.status(400).json({ error: "Missing image or fileName" });
      }
      const url = await uploadImageToS3(image, fileName);
      res.json({ url });
    } catch (error) {
      console.error("S3 Upload Error:", error);
      res.status(500).json({ error: "Failed to upload to S3" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
