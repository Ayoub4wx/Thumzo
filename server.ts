import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import {
  handleAiAnalyze,
  handleAiAutoTitle,
  handleAiCtrScore,
  handleAiFaceOptimize,
  handleAiGenerate,
  handleAiClarify,
  handleAiIdeas,
  handleAiOptimizationPack,
  handleAiViralPattern,
  handleAccountExport,
  handleAccountOnboarding,
  handleAuthMagicLink,
  handleAuthPasswordReset,
  handleAuthSignup,
  handleBillingCheckout,
  handleBillingMe,
  handleBillingUsage,
  handleCronOnboardingEmails,
  handleEmailUnsubscribe,
  handleYoutubeIntegrationChannel,
  handleYoutubeIntegrationDisconnect,
  handleYoutubeIntegrationStart,
  handleYoutubeIntegrationStatus,
  handleYoutubeIntegrationVideos,
  handleYoutubeOauthCallback,
  handleHealth,
  handleWhopWebhook,
  handleDeleteAccount,
  handleYoutubeThumbnail,
  handleStorageTitler,
} from "./src/server/handlers";
import { getSupabaseAdmin } from "./src/server/supabaseAdmin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 4444;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeHostname(hostHeader = "") {
  const trimmed = hostHeader.split(",")[0]?.trim() || "";

  if (trimmed.startsWith("[")) {
    const closingBracketIndex = trimmed.indexOf("]");
    return closingBracketIndex >= 0 ? trimmed.slice(1, closingBracketIndex).toLowerCase() : trimmed.toLowerCase();
  }

  return trimmed.replace(/:\d+$/, "").toLowerCase();
}

function isLocalHostname(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

function deriveTemplateTitle(sourceName: string) {
  let derivedTitle = sourceName
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  if (!derivedTitle || /^[a-z0-9]{10,}$/i.test(derivedTitle)) {
    return "Untitled Template";
  }

  return derivedTitle
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function buildPublicUrl(key: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  if (!supabaseUrl) return null;
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/thumbnails/${encodedKey}`;
}

function requireLocalAdminAccess(req: Request, res: Response, next: NextFunction) {
  const remoteIp = req.socket.remoteAddress || "";
  const isLocalIp = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
  if (!isLocalIp) {
    res.status(403).json({ error: "Admin routes are only available on localhost." });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const bucketName = "thumbnails";

  app.post("/api/webhooks/whop", express.text({ type: "*/*", limit: "2mb" }), (req, res) =>
    void handleWhopWebhook(typeof req.body === "string" ? req.body : "", req.headers, res)
  );
  app.use(express.json({ limit: "25mb" }));

  const aiRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please wait before trying again." },
  });
  app.use("/api/ai/", aiRateLimit);

  app.get("/api/health", (req, res) => void handleHealth(req, res));
  app.post("/api/auth/signup", (req, res) => void handleAuthSignup(req, res));
  app.post("/api/auth/magic-link", (req, res) => void handleAuthMagicLink(req, res));
  app.post("/api/auth/password-reset", (req, res) => void handleAuthPasswordReset(req, res));
  app.get("/api/account/export", (req, res) => void handleAccountExport(req, res));
  app.post("/api/account/onboarding", (req, res) => void handleAccountOnboarding(req, res));
  app.delete("/api/account/delete", (req, res) => void handleDeleteAccount(req, res));
  app.get("/api/billing/me", (req, res) => void handleBillingMe(req, res));
  app.get("/api/billing/usage", (req, res) => void handleBillingUsage(req, res));
  app.post("/api/billing/checkout", (req, res) => void handleBillingCheckout(req, res));
  app.get("/api/cron/onboarding-emails", (req, res) => void handleCronOnboardingEmails(req, res));
  app.get("/api/email/unsubscribe", (req, res) => void handleEmailUnsubscribe(req, res));
  app.post("/api/ai/clarify", (req, res) => void handleAiClarify(req, res));
  app.post("/api/ai/generate", (req, res) => void handleAiGenerate(req, res));
  app.post("/api/ai/analyze", (req, res) => void handleAiAnalyze(req, res));
  app.post("/api/ai/ideas", (req, res) => void handleAiIdeas(req, res));
  app.post("/api/ai/auto-title", (req, res) => void handleAiAutoTitle(req, res));
  app.post("/api/ai/ctr-score", (req, res) => void handleAiCtrScore(req, res));
  app.post("/api/ai/optimization-pack", (req, res) => void handleAiOptimizationPack(req, res));
  app.post("/api/ai/face-optimize", (req, res) => void handleAiFaceOptimize(req, res));
  app.post("/api/ai/viral-pattern", (req, res) => void handleAiViralPattern(req, res));
  app.post("/api/integrations/youtube/start", (req, res) => void handleYoutubeIntegrationStart(req, res));
  app.get("/api/integrations/youtube/callback", (req, res) => void handleYoutubeOauthCallback(req, res));
  app.get("/api/integrations/youtube", (req, res) => void handleYoutubeIntegrationStatus(req, res));
  app.post("/api/integrations/youtube/channel", (req, res) => void handleYoutubeIntegrationChannel(req, res));
  app.post("/api/integrations/youtube/disconnect", (req, res) => void handleYoutubeIntegrationDisconnect(req, res));
  app.get("/api/integrations/youtube/videos", (req, res) => void handleYoutubeIntegrationVideos(req, res));
  app.post("/api/youtube/thumbnail", (req, res) => void handleYoutubeThumbnail(req, res));
  app.post("/api/webhooks/storage-titler", (req, res) => void handleStorageTitler(req, res));

  // Admin middleware must be registered BEFORE admin route handlers so it always runs first
  app.use("/api/admin", requireLocalAdminAccess);
  app.use(/^\/admin(?:\/|$)/, requireLocalAdminAccess);


  app.get("/api/admin/templates", async (_req, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      res.json({
        templates: data || [],
      });
    } catch (error) {
      console.error("Failed to load templates", error);
      res.status(500).json({ error: "Failed to load templates." });
    }
  });

  app.post("/api/admin/templates/upload", async (req, res) => {
    const { fileName, contentType, dataBase64, originalName } = req.body ?? {};

    if (!fileName || typeof fileName !== "string") {
      res.status(400).json({ error: "fileName is required." });
      return;
    }

    if (!contentType || typeof contentType !== "string" || !contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image uploads are allowed." });
      return;
    }

    if (!dataBase64 || typeof dataBase64 !== "string") {
      res.status(400).json({ error: "dataBase64 is required." });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      const uploadBody = Buffer.from(dataBase64, "base64");
      const { error: uploadError } = await supabaseAdmin.storage.from("thumbnails").upload(fileName, uploadBody, {
        contentType,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(fileName);

      const { data, error } = await supabaseAdmin
        .from("templates")
        .insert({
          title: deriveTemplateTitle(typeof originalName === "string" ? originalName : fileName),
          image_url: publicUrl,
          category: "general",
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({
        template: data,
      });
    } catch (error) {
      console.error("Failed to upload template", error);
      res.status(500).json({ error: "Failed to upload template." });
    }
  });

  app.post("/api/admin/templates/sync", async (_req, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: files, error: storageError } = await supabaseAdmin.storage.from("thumbnails").list("", {
        limit: 100,
      });

      if (storageError) {
        throw storageError;
      }

      const { data: existingRecords, error: existingError } = await supabaseAdmin.from("templates").select("image_url");

      if (existingError) {
        throw existingError;
      }

      const existingUrls = new Set((existingRecords || []).map((record) => record.image_url));
      const newRecords = (files || [])
        .filter((file) => file.name && file.name !== ".emptyFolderPlaceholder")
        .filter((file) => !file.name.toLowerCase().startsWith("avatars/"))
        .map((file) => {
          const {
            data: { publicUrl },
          } = supabaseAdmin.storage.from("thumbnails").getPublicUrl(file.name);

          return {
            title: deriveTemplateTitle(file.name),
            image_url: publicUrl,
            category: "general",
          };
        })
        .filter((record) => !existingUrls.has(record.image_url));

      if (newRecords.length > 0) {
        const { error: insertError } = await supabaseAdmin.from("templates").insert(newRecords);

        if (insertError) {
          throw insertError;
        }
      }

      res.json({
        synced: newRecords.length,
      });
    } catch (error) {
      console.error("Failed to sync templates", error);
      res.status(500).json({ error: "Failed to sync templates from storage." });
    }
  });

  app.patch("/api/admin/templates/:id", async (req, res) => {
    const { id } = req.params;
    const { title, category, is_trending, is_popular, is_new, tags } = req.body ?? {};

    if (!id) {
      res.status(400).json({ error: "Template id is required." });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data, error } = await supabaseAdmin
        .from("templates")
        .update({
          title,
          category,
          is_trending,
          is_popular,
          is_new,
          tags: Array.isArray(tags) ? tags : [],
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      res.json({
        template: data,
      });
    } catch (error) {
      console.error("Failed to update template", error);
      res.status(500).json({ error: "Failed to update template." });
    }
  });

  app.delete("/api/admin/templates/:id", async (req, res) => {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "Template id is required." });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();

      // 1. Get the template to find the image URL before deleting
      const { data: template, error: fetchError } = await supabaseAdmin
        .from("templates")
        .select("image_url")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (template?.image_url) {
        // 2. Extract storage path from URL
        // Example URL: https://xyz.supabase.co/storage/v1/object/public/thumbnails/templates/file.png
        const marker = "/storage/v1/object/public/thumbnails/";
        if (template.image_url.includes(marker)) {
          const path = decodeURIComponent(template.image_url.split(marker)[1]);
          if (path) {
            console.log(`Deleting storage object: ${path}`);
            await supabaseAdmin.storage.from(bucketName).remove([path]);
          }
        }
      }

      // 3. Delete the database record
      const { error } = await supabaseAdmin.from("templates").delete().eq("id", id);

      if (error) {
        throw error;
      }

      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete template", error);
      res.status(500).json({ error: "Failed to delete template." });
    }
  });

  app.get("/api/admin/storage/objects", async (_req, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: files, error } = await supabaseAdmin.storage
        .from(bucketName)
        .list("", { limit: 200, sortBy: { column: "name", order: "asc" } });

      if (error) throw error;

      const items = (files || [])
        .filter((file) => file.name !== ".emptyFolderPlaceholder")
        .filter((file) => !file.name.toLowerCase().startsWith("avatars/"))
        .map((file) => ({
          key: file.name,
          size: file.metadata?.size ?? 0,
          lastModified: file.updated_at || file.created_at || null,
          url: buildPublicUrl(file.name),
        }));

      res.json({
        bucket: bucketName,
        items,
      });
    } catch (error) {
      console.error("Failed to list Supabase storage objects", error);
      res.status(500).json({ error: "Failed to list storage objects." });
    }
  });

  app.post("/api/admin/storage/upload", async (req, res) => {
    const { fileName, contentType, dataBase64 } = req.body ?? {};

    if (!fileName || !dataBase64) {
      res.status(400).json({ error: "fileName and dataBase64 are required." });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();
      const body = Buffer.from(dataBase64, "base64");

      const { error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(fileName, body, {
          contentType: contentType || "image/png",
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      res.json({
        key: fileName,
        url: buildPublicUrl(fileName),
      });
    } catch (error) {
      console.error("Failed to upload Supabase storage object", error);
      res.status(500).json({ error: "Failed to upload thumbnail." });
    }
  });

  app.post("/api/admin/storage/rename", async (req, res) => {
    const { fromKey, toKey } = req.body ?? {};

    if (!fromKey || !toKey) {
      res.status(400).json({ error: "fromKey and toKey are required." });
      return;
    }

    if (fromKey === toKey) {
      res.status(400).json({ error: "New file name must be different from the current file name." });
      return;
    }

    try {
      const supabaseAdmin = getSupabaseAdmin();

      const { error: moveError } = await supabaseAdmin.storage
        .from(bucketName)
        .move(fromKey, toKey);

      if (moveError) throw moveError;

      res.json({
        key: toKey,
        url: buildPublicUrl(toKey),
      });
    } catch (error) {
      console.error("Failed to rename Supabase storage object", error);
      res.status(500).json({ error: "Failed to rename thumbnail." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production setup
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
