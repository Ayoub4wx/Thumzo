import { statSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const dotenvFiles = [".env.local", ".env"];
let lastDotenvSignature: string | null = null;

function getDotenvSignature() {
  return dotenvFiles
    .map((fileName) => {
      const filePath = path.resolve(process.cwd(), fileName);

      try {
        const stats = statSync(filePath);
        return `${filePath}:${stats.size}:${stats.mtimeMs}`;
      } catch {
        return `${filePath}:missing`;
      }
    })
    .join("|");
}

function refreshDotenv() {
  const signature = getDotenvSignature();

  if (signature === lastDotenvSignature) {
    return;
  }

  for (const fileName of dotenvFiles) {
    loadDotenv({
      path: path.resolve(process.cwd(), fileName),
      override: true,
    });
  }

  lastDotenvSignature = signature;
}

function getOptionalEnv(name: string) {
  refreshDotenv();
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getRequiredEnv(name: string) {
  const value = getOptionalEnv(name);

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export const serverEnv = {
  get appUrl() { return getOptionalEnv("APP_URL"); },
  get authRedirectBaseUrl() { return getOptionalEnv("AUTH_REDIRECT_BASE_URL"); },
  get supabaseUrl() { return getOptionalEnv("VITE_SUPABASE_URL"); },
  get supabaseAnonKey() { return getOptionalEnv("VITE_SUPABASE_ANON_KEY") || getOptionalEnv("VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY"); },
  get supabaseServiceRoleKey() { return getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY"); },
  get googleOauthClientId() { return getOptionalEnv("GOOGLE_OAUTH_CLIENT_ID"); },
  get googleOauthClientSecret() { return getOptionalEnv("GOOGLE_OAUTH_CLIENT_SECRET"); },
  get googleOauthStateSecret() { return getOptionalEnv("GOOGLE_OAUTH_STATE_SECRET"); },
  get geminiApiKey() { return getOptionalEnv("GEMINI_API_KEY"); },
  get openaiApiKey() { return getOptionalEnv("OPENAI_API_KEY"); },
  get whopApiKey() { return getOptionalEnv("WHOP_API_KEY"); },
  get whopWebhookSecret() { return getOptionalEnv("WHOP_WEBHOOK_SECRET"); },
  get whopCompanyId() { return getOptionalEnv("WHOP_COMPANY_ID"); },
  get whopCreatorPlanId() { return getOptionalEnv("WHOP_CREATOR_PLAN_ID"); },
  get whopCreatorPlusPlanId() { return getOptionalEnv("WHOP_CREATOR_PLUS_PLAN_ID"); },
  get whopUltraPlanId() { return getOptionalEnv("WHOP_ULTRA_PLAN_ID"); },
  get whopTopUpPlanId() { return getOptionalEnv("WHOP_TOP_UP_PLAN_ID"); },
  get cronSecret() { return getOptionalEnv("CRON_SECRET"); },
  get resendApiKey() { return getOptionalEnv("RESEND_API_KEY"); },
  get resendFromEmail() { return getOptionalEnv("RESEND_FROM_EMAIL"); },
  get unsubscribeSecret() { return getOptionalEnv("UNSUBSCRIBE_SECRET"); },
  get storageTitlerSecret() { return getOptionalEnv("STORAGE_TITLER_SECRET"); },
};

function normalizeHostname(hostHeader: string) {
  const trimmed = hostHeader.split(",")[0]?.trim() || "";

  if (trimmed.startsWith("[")) {
    const closingBracketIndex = trimmed.indexOf("]");
    return closingBracketIndex >= 0 ? trimmed.slice(1, closingBracketIndex).toLowerCase() : trimmed.toLowerCase();
  }

  return trimmed.replace(/:\d+$/, "").toLowerCase();
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]" || hostname.endsWith(".localhost");
}

function canonicalizeAppUrl(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname === "thumoraai.com") {
      url.hostname = "www.thumoraai.com";
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

export function resolveRequestedAppUrl(headers?: Record<string, unknown>) {
  const hostHeader = String(
    headers?.["x-forwarded-host"] ||
      headers?.["X-Forwarded-Host"] ||
      headers?.host ||
      headers?.Host ||
      ""
  ).trim();

  if (!hostHeader) {
    return null;
  }

  const forwardedProto = String(headers?.["x-forwarded-proto"] || headers?.["X-Forwarded-Proto"] || "").trim();
  const normalizedHostname = normalizeHostname(hostHeader);
  const protocol = isLocalHostname(normalizedHostname) ? forwardedProto || "http" : forwardedProto || "https";

  return canonicalizeAppUrl(`${protocol}://${hostHeader}`);
}

export function resolveAppUrl(headers?: Record<string, unknown>) {
  if (serverEnv.appUrl) {
    return canonicalizeAppUrl(serverEnv.appUrl);
  }

  const isBehindProxy = process.env.TRUST_PROXY === "true";
  const hostHeader = String(
    (isBehindProxy ? headers?.["x-forwarded-host"] || headers?.["X-Forwarded-Host"] : null) ||
      headers?.host ||
      headers?.Host ||
      ""
  ).trim();
  const forwardedProto = String(headers?.["x-forwarded-proto"] || headers?.["X-Forwarded-Proto"] || "").trim();
  const normalizedHostname = normalizeHostname(hostHeader);

  if (!hostHeader) {
    return "http://localhost:3000";
  }

  if (isLocalHostname(normalizedHostname)) {
    const protocol = (isBehindProxy ? forwardedProto : null) || "http";
    return canonicalizeAppUrl(`${protocol}://${hostHeader}`);
  }

  throw new Error("APP_URL must be configured in production.");
}

export function resolveAuthRedirectBaseUrl(headers?: Record<string, unknown>) {
  const configuredUrl = serverEnv.authRedirectBaseUrl?.replace(/\/$/, "");

  if (configuredUrl) {
    return canonicalizeAppUrl(configuredUrl);
  }

  return canonicalizeAppUrl(resolveAppUrl(headers).replace(/\/$/, ""));
}
