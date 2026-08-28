import { createHash } from "node:crypto";
import {
  handleHealth, 
  handleAccountExport, 
  handleAccountOnboarding,
  handleAuthMagicLink,
  handleAuthPasswordReset,
  handleAuthSignup,
  handleBillingMe, 
  handleBillingUsage,
  handleBillingCheckout, 
  handleCronOnboardingEmails,
  handleEmailUnsubscribe,
  handleAiClarify,
  handleAiCtrScore,
  handleAiFaceOptimize,
  handleAiGenerate, 
  handleAiIdeas,
  handleAiAnalyze, 
  handleAiAutoTitle,
  handleAiOptimizationPack,
  handleAiViralPattern,
  handleYoutubeIntegrationStart, 
  handleYoutubeOauthCallback, 
  handleYoutubeIntegrationStatus, 
  handleYoutubeIntegrationChannel, 
  handleYoutubeIntegrationDisconnect, 
  handleYoutubeIntegrationVideos, 
  handleYoutubeThumbnail, 
  handleStorageTitler, 
  handleDeleteAccount, 
  handleWhopWebhook 
} from "../src/server/handlers.js";
import { readRawBody } from "./_utils.js";

const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AI_RATE_LIMIT_MAX_REQUESTS = 30;
const aiRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function readHeader(req: any, name: string) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return typeof value === "string" ? value : value != null ? String(value) : "";
}

function getClientIp(req: any) {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  return forwardedFor.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function getAiRateLimitKey(req: any) {
  const authorization = readHeader(req, "authorization");

  if (authorization) {
    return `auth:${createHash("sha256").update(authorization).digest("hex").slice(0, 32)}`;
  }

  return `ip:${getClientIp(req)}`;
}

function enforceAiRateLimit(path: string, req: any, res: any) {
  if (!path.startsWith("/api/ai/")) {
    return true;
  }

  const now = Date.now();
  const key = getAiRateLimitKey(req);
  const existingBucket = aiRateLimitBuckets.get(key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + AI_RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  aiRateLimitBuckets.set(key, bucket);

  if (aiRateLimitBuckets.size > 1000) {
    for (const [bucketKey, value] of aiRateLimitBuckets) {
      if (value.resetAt <= now) {
        aiRateLimitBuckets.delete(bucketKey);
      }
    }
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.setHeader?.("X-RateLimit-Limit", String(AI_RATE_LIMIT_MAX_REQUESTS));
  res.setHeader?.("X-RateLimit-Remaining", String(Math.max(0, AI_RATE_LIMIT_MAX_REQUESTS - bucket.count)));
  res.setHeader?.("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > AI_RATE_LIMIT_MAX_REQUESTS) {
    res.setHeader?.("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: "Too many requests. Please wait before trying again." });
    return false;
  }

  return true;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/$/, "");
  req.query = Object.fromEntries(url.searchParams.entries());

  try {
    // Whop Webhook needs raw body and special handling
    if (path === "/api/webhooks/whop") {
      const rawBody = await readRawBody(req);
      return await handleWhopWebhook(rawBody, req.headers, res);
    }

    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }

    if (!enforceAiRateLimit(path, req, res)) {
      return;
    }

    // All other APIs can use parsed JSON body
    // Since we disabled bodyParser, we must parse it ourselves if it's a POST/PATCH/PUT
    let body = {};
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      const rawBody = await readRawBody(req);
      if (rawBody) {
        try {
          body = JSON.parse(rawBody);
        } catch (e) {
          // Fallback for non-JSON or malformed
        }
      }
    }
    req.body = body;

    switch (path) {
      case "/api/health":
        return await handleHealth(req, res);
      case "/api/auth/signup":
        return await handleAuthSignup(req, res);
      case "/api/auth/magic-link":
        return await handleAuthMagicLink(req, res);
      case "/api/auth/password-reset":
        return await handleAuthPasswordReset(req, res);
      case "/api/account/export":
        return await handleAccountExport(req, res);
      case "/api/account/onboarding":
        return await handleAccountOnboarding(req, res);
      case "/api/account/delete":
        return await handleDeleteAccount(req, res);
      case "/api/billing/me":
        return await handleBillingMe(req, res);
      case "/api/billing/usage":
        return await handleBillingUsage(req, res);
      case "/api/billing/checkout":
        return await handleBillingCheckout(req, res);
      case "/api/cron/onboarding-emails":
        return await handleCronOnboardingEmails(req, res);
      case "/api/email/unsubscribe":
        return await handleEmailUnsubscribe(req, res);
      case "/api/ai/clarify":
        return await handleAiClarify(req, res);
      case "/api/ai/generate":
        return await handleAiGenerate(req, res);
      case "/api/ai/analyze":
        return await handleAiAnalyze(req, res);
      case "/api/ai/ideas":
        return await handleAiIdeas(req, res);
      case "/api/ai/auto-title":
        return await handleAiAutoTitle(req, res);
      case "/api/ai/ctr-score":
        return await handleAiCtrScore(req, res);
      case "/api/ai/optimization-pack":
        return await handleAiOptimizationPack(req, res);
      case "/api/ai/face-optimize":
        return await handleAiFaceOptimize(req, res);
      case "/api/ai/viral-pattern":
        return await handleAiViralPattern(req, res);
      case "/api/integrations/youtube/start":
        return await handleYoutubeIntegrationStart(req, res);
      case "/api/integrations/youtube/callback":
        return await handleYoutubeOauthCallback(req, res);
      case "/api/integrations/youtube":
        return await handleYoutubeIntegrationStatus(req, res);
      case "/api/integrations/youtube/channel":
        return await handleYoutubeIntegrationChannel(req, res);
      case "/api/integrations/youtube/disconnect":
        return await handleYoutubeIntegrationDisconnect(req, res);
      case "/api/integrations/youtube/videos":
        return await handleYoutubeIntegrationVideos(req, res);
      case "/api/youtube/thumbnail":
        return await handleYoutubeThumbnail(req, res);
      case "/api/webhooks/storage-titler":
        return await handleStorageTitler(req, res);
      default:
        res.status(404).json({ error: "API route not found" });
    }
  } catch (error) {
    console.error(`API Error at ${path}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
