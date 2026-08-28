import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  applyViralPatternOnServer,
  generateImagesOnServer,
  generateOptimizationPackOnServer,
  analyzeImageOnServer,
  generateThumbnailIdeasOnServer,
  generateViralTitleFromImage,
  clarifyPromptOnServer,
  optimizeFaceOnServer,
  scoreThumbnailCtrOnServer,
} from "./ai.js";
import {
  consumeOneCredit,
  createCheckoutForUser,
  getBillingSnapshotForUser,
  getUsageHistory,
  handleWhopWebhookEvent,
  refundConsumedCredit,
  cancelAllUserMemberships,
} from "./billing.js";
import { resolveAppUrl, resolveAuthRedirectBaseUrl, resolveRequestedAppUrl, serverEnv } from "./env.js";
import { DEFAULT_GEMINI_IMAGE_MODEL, SUPPORTED_IMAGE_MODELS, resolveGeminiImageModelId } from "../lib/geminiShared.js";
import { requireAuthenticatedUser, getSupabaseAdmin } from "./supabaseAdmin.js";
import type {
  AccountExportPayload,
  CtrEstimate,
  GrowthExperiment,
  GrowthPatternKey,
  GrowthVariant,
  YoutubeChannelSummary,
  YoutubeIntegrationStatus,
  YoutubeVideoSummary,
  YoutubeVideosResponse,
} from "./types.js";
import { getWhopClient, getWhopWebhookKey } from "./whop.js";
import { isPaidPlan } from "../lib/billingPlans.js";

type RequestLike = {
  body?: any;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
  send: (payload?: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  redirect?: (url: string) => void;
};

type YoutubeIntegrationRow = {
  user_id: string;
  google_account_id: string | null;
  google_account_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  selected_channel_id: string | null;
  selected_channel_title: string | null;
  selected_channel_handle: string | null;
  selected_channel_thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SignedOauthState = {
  userId: string;
  returnPath: string;
  returnOrigin: string | null;
  issuedAt: number;
};

const YOUTUBE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
];
const YOUTUBE_STATE_MAX_AGE_MS = 15 * 60 * 1000;
const GROWTH_PATTERN_KEYS = new Set<GrowthPatternKey>([
  "high_stakes_challenge",
  "ai_authority",
  "finance_signal",
]);
const GROWTH_SCHEMA_SETUP_MESSAGE =
  "Growth Lab database tables are not installed. Run the Growth Lab section of schema.sql in Supabase, then retry.";

type AuthenticatedOptimizationUser = {
  id: string;
  email?: string;
};

type GeneratedGrowthVariant = Omit<GrowthVariant, "id" | "experimentId" | "imageUrl" | "createdAt"> & {
  imageDataUrl: string;
};

function normalizeGrowthPatternKey(value: unknown): GrowthPatternKey | null {
  return typeof value === "string" && GROWTH_PATTERN_KEYS.has(value as GrowthPatternKey)
    ? value as GrowthPatternKey
    : null;
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);

  if (!match) {
    throw new Error("Expected a base64 image data URL.");
  }

  return {
    mimeType: match[1] || "image/png",
    buffer: Buffer.from(match[2] || "", "base64"),
  };
}

function isGrowthSchemaError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string"
      ? candidate.message
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const normalizedMessage = message.toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    (
      (normalizedMessage.includes("growth_experiments") || normalizedMessage.includes("growth_variants")) &&
      (
        normalizedMessage.includes("does not exist") ||
        normalizedMessage.includes("could not find") ||
        normalizedMessage.includes("schema cache")
      )
    )
  );
}

function buildGrowthSchemaSetupError() {
  return new Error(
    JSON.stringify({
      error: {
        code: 503,
        status: "UNAVAILABLE",
        message: GROWTH_SCHEMA_SETUP_MESSAGE,
      },
    }),
  );
}

function sendGrowthSchemaSetupResponse(res: ResponseLike) {
  res.status(503).json({
    error: GROWTH_SCHEMA_SETUP_MESSAGE,
    setupRequired: true,
  });
}

async function ensureGrowthSchemaAvailable(res: ResponseLike) {
  const supabase = getSupabaseAdmin();
  const checks = await Promise.all([
    supabase.from("growth_experiments").select("id").limit(1),
    supabase.from("growth_variants").select("id").limit(1),
  ]);
  const failingCheck = checks.find((check) => check.error);

  if (!failingCheck?.error) {
    return true;
  }

  if (isGrowthSchemaError(failingCheck.error)) {
    sendGrowthSchemaSetupResponse(res);
    return false;
  }

  throw failingCheck.error;
}

function sanitizeStorageLabel(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return normalized || fallback;
}

async function uploadGrowthImage(userId: string, dataUrl: string, label: string) {
  const { mimeType, buffer } = parseImageDataUrl(dataUrl);
  const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const path = `${userId}/growth/${sanitizeStorageLabel(label, "growth-variant")}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const { error } = await getSupabaseAdmin().storage.from("user-assets").upload(path, buffer, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return path;
}

async function requirePaidOptimizationUser(req: RequestLike, res: ResponseLike): Promise<AuthenticatedOptimizationUser | null> {
  const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
  const billing = await getBillingSnapshotForUser(user.id);

  if (!isPaidPlan(billing.planKey)) {
    res.status(403).json({
      error: "Growth optimization is available on paid plans.",
      billing,
    });
    return null;
  }

  return user;
}

function mapGrowthVariantRow(row: any): GrowthVariant {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    title: row.title,
    prompt: row.prompt,
    imageUrl: row.image_url,
    ctrEstimate: row.ctr_estimate,
    mockMetrics: row.mock_metrics,
    metricsSource: row.metrics_source || "mock",
    externalVideoId: row.external_video_id,
    patternKey: normalizeGrowthPatternKey(row.pattern_key),
    status: row.status || "draft",
    createdAt: row.created_at,
  };
}

function mapGrowthExperimentRow(row: any, variants: GrowthVariant[]): GrowthExperiment {
  return {
    id: row.id,
    title: row.title,
    sourceTitle: row.source_title,
    sourceImageUrl: row.source_image_url,
    experimentType: row.experiment_type,
    status: row.status || "draft",
    metricsSource: row.metrics_source || "mock",
    externalVideoId: row.external_video_id,
    analysis: row.analysis || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
  };
}

async function persistGrowthExperiment(params: {
  userId: string;
  title: string;
  sourceTitle: string;
  sourceImageUrl: string | null;
  experimentType: GrowthExperiment["experimentType"];
  analysis?: Record<string, unknown>;
  variants: GeneratedGrowthVariant[];
}) {
  const supabase = getSupabaseAdmin();
  const { data: experiment, error: experimentError } = await supabase
    .from("growth_experiments")
    .insert({
      user_id: params.userId,
      title: params.title,
      source_title: params.sourceTitle,
      source_image_url: params.sourceImageUrl,
      experiment_type: params.experimentType,
      status: "draft",
      metrics_source: "mock",
      external_video_id: null,
      analysis: params.analysis || {},
    })
    .select("*")
    .single();

  if (experimentError) {
    if (isGrowthSchemaError(experimentError)) {
      throw buildGrowthSchemaSetupError();
    }

    throw experimentError;
  }

  const variantRows = [];
  for (const variant of params.variants) {
    const imageUrl = await uploadGrowthImage(params.userId, variant.imageDataUrl, variant.title);
    variantRows.push({
      user_id: params.userId,
      experiment_id: experiment.id,
      title: variant.title,
      prompt: variant.prompt,
      image_url: imageUrl,
      ctr_estimate: variant.ctrEstimate,
      analysis: variant.ctrEstimate.analysis || {},
      mock_metrics: variant.mockMetrics,
      metrics_source: variant.metricsSource,
      external_video_id: variant.externalVideoId,
      pattern_key: variant.patternKey,
      status: variant.status,
    });
  }

  const { data: variants, error: variantError } = await supabase
    .from("growth_variants")
    .insert(variantRows)
    .select("*");

  if (variantError) {
    if (isGrowthSchemaError(variantError)) {
      throw buildGrowthSchemaSetupError();
    }

    throw variantError;
  }

  return mapGrowthExperimentRow(
    experiment,
    (variants || [])
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(mapGrowthVariantRow),
  );
}

export async function handleHealth(_req: RequestLike, res: ResponseLike) {
  res.status(200).json({
    ok: true,
    service: "thumora-ai",
    timestamp: new Date().toISOString(),
  });
}

function applySecurityHeaders(res: ResponseLike) {
  if (!res.setHeader) return;
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  // Enforce strict transport security (HSTS)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Prevent cross-site scripting (XSS)
  res.setHeader("X-XSS-Protection", "1; mode=block");
}

function normalizeHeaderRecord(headers: Record<string, unknown> | undefined) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) {
      normalized[key] = value.join(", ");
    } else if (typeof value === "string") {
      normalized[key] = value;
    } else if (value != null) {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

function readHeader(headers: Record<string, unknown> | undefined, name: string) {
  const direct = headers?.[name];
  const lower = headers?.[name.toLowerCase()];
  const value = direct ?? lower;

  if (Array.isArray(value)) {
    return value[0] || null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value != null ? String(value) : null;
}

function safeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    const normalizedHostname = hostname.toLowerCase();

    return (
      normalizedHostname === "localhost" ||
      normalizedHostname === "127.0.0.1" ||
      normalizedHostname === "::1" ||
      normalizedHostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function addAllowedOrigin(origins: Set<string>, value: string | null | undefined) {
  const origin = parseOrigin(value ?? null);
  if (!origin) {
    return;
  }

  origins.add(origin);

  try {
    const url = new URL(origin);
    if (url.hostname === "thumoraai.com") {
      url.hostname = "www.thumoraai.com";
      origins.add(url.origin);
    }
  } catch {
    // Ignore invalid origin variants.
  }
}

function getAllowedRequestOrigins(headers?: Record<string, unknown>) {
  const origins = new Set<string>();

  addAllowedOrigin(origins, "https://www.thumoraai.com");
  addAllowedOrigin(origins, "https://thumoraai.com");
  addAllowedOrigin(origins, serverEnv.appUrl);
  addAllowedOrigin(origins, serverEnv.authRedirectBaseUrl);
  addAllowedOrigin(origins, resolveRequestedAppUrl(headers));

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    addAllowedOrigin(origins, `https://${vercelUrl}`);
  }

  return origins;
}

function requireSecureOrigin(req: RequestLike) {
  const origin = parseOrigin(readHeader(req.headers, "origin") || readHeader(req.headers, "referer"));

  if (!origin) {
    if (readHeader(req.headers, "authorization")) {
      return;
    }

    throw new Error("Forbidden: Missing origin.");
  }

  if (isLocalOrigin(origin)) {
    return;
  }

  if (!getAllowedRequestOrigins(req.headers).has(origin)) {
    throw new Error("Forbidden: Invalid origin.");
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : null;
    const details = "details" in error && typeof (error as { details?: unknown }).details === "string"
      ? (error as { details: string }).details
      : null;
    const hint = "hint" in error && typeof (error as { hint?: unknown }).hint === "string"
      ? (error as { hint: string }).hint
      : null;
    const combined = [message, details, hint].filter(Boolean).join(" ");

    if (combined) {
      return combined;
    }
  }

  return "Unexpected server error.";
}

function normalizeAuthEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidAuthEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAlreadyRegisteredAuthError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  );
}

function isMissingUserAuthError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return message.includes("user not found") || message.includes("not found");
}

function respondWithAuthInputError(res: ResponseLike, error: string) {
  res.status(400).json({ error });
}

function respondWithAuthRouteError(res: ResponseLike, error: unknown) {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const status =
    normalizedMessage.includes("rate limit") || normalizedMessage.includes("too many requests")
      ? 429
      : normalizedMessage.includes("email delivery is not configured")
        ? 503
        : 500;

  res.status(status).json({ error: toClientSafeMessage(message, status) });
}

function buildAuthEmailIdempotencyKey(prefix: string, email: string, actionUrl: string) {
  const digest = createHash("sha256").update(`${email}:${actionUrl}`).digest("hex").slice(0, 24);
  const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));

  return `${prefix}-${digest}-${fiveMinuteBucket}`;
}

function rewriteSupabaseActionRedirect(actionLink: string, redirectTo: string) {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
}

function buildRecoveryActionUrl(appUrl: string, tokenHash: string | undefined, fallbackActionLink: string, redirectTo: string) {
  if (!tokenHash) {
    return rewriteSupabaseActionRedirect(fallbackActionLink, redirectTo);
  }

  const url = new URL("/auth/recovery", `${appUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("next", "/settings/privacy?recovery=true");

  return url.toString();
}

function buildMarketingUnsubscribeUrl(userId: string, headers?: Record<string, unknown>) {
  const secret = serverEnv.unsubscribeSecret;
  if (!secret) {
    return null;
  }

  const payload = {
    userId,
    purpose: "marketing_unsubscribe",
    issuedAt: Date.now(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = encodeBase64Url(createHmac("sha256", secret).update(encodedPayload).digest());
  const url = new URL("/api/email/unsubscribe", `${resolveAuthRedirectBaseUrl(headers).replace(/\/$/, "")}/`);
  url.searchParams.set("token", `${encodedPayload}.${signature}`);

  return url.toString();
}

type AuthEmailTemplateKey = "confirmAccount" | "continueAccount" | "magicLink" | "resetPassword";

async function sendAuthActionEmail({
  to,
  subject,
  actionUrl,
  idempotencyPrefix,
  template,
  magicLinkMode,
}: {
  to: string;
  subject: string;
  actionUrl: string;
  idempotencyPrefix: string;
  template: AuthEmailTemplateKey;
  magicLinkMode?: "login" | "signup";
}) {
  if (!serverEnv.resendApiKey) {
    throw new Error("Email delivery is not configured.");
  }

  const [{ sendEmail }, authTemplates] = await Promise.all([
    import("./mailer.js"),
    import("../emails/AuthActionEmail.js"),
  ]);
  const react =
    template === "confirmAccount"
      ? authTemplates.ConfirmAccountEmail({ actionUrl })
      : template === "continueAccount"
        ? authTemplates.ContinueAccountEmail({ actionUrl })
        : template === "magicLink"
          ? authTemplates.MagicLinkEmail({ actionUrl, mode: magicLinkMode ?? "login" })
          : authTemplates.ResetPasswordEmail({ actionUrl });

  return await sendEmail({
    to,
    subject,
    react: react as any,
    idempotencyKey: buildAuthEmailIdempotencyKey(idempotencyPrefix, to, actionUrl),
  });
}

export async function handleAuthSignup(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);

    const email = normalizeAuthEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const marketingConsent = req.body?.marketingConsent === true;
    const acceptedTerms = req.body?.acceptedTerms === true;

    if (!isValidAuthEmail(email)) {
      respondWithAuthInputError(res, "Enter a valid email address.");
      return;
    }

    if (!password.trim()) {
      respondWithAuthInputError(res, "Password is required.");
      return;
    }

    if (!acceptedTerms) {
      respondWithAuthInputError(res, "You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (!serverEnv.resendApiKey) {
      throw new Error("Email delivery is not configured.");
    }

    const appUrl = resolveAuthRedirectBaseUrl(req.headers);
    const supabaseAdmin = getSupabaseAdmin();
    const metadata = { marketing_consent: marketingConsent };
    const signupRedirectUrl = `${appUrl}/login`;
    const existingAccountRedirectUrl = `${appUrl}/projects`;
    let actionUrl = "";
    let subject = "Confirm your Thumora AI account";
    let idempotencyPrefix = "auth-signup";
    let template: AuthEmailTemplateKey = "confirmAccount";
    let emailAction: "confirm" | "sign_in" = "confirm";

    const { data: signupData, error: signupError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        data: metadata,
        redirectTo: signupRedirectUrl,
      },
    });

    if (signupError) {
      if (!isAlreadyRegisteredAuthError(signupError)) {
        throw signupError;
      }

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          data: metadata,
          redirectTo: existingAccountRedirectUrl,
        },
      });

      if (linkError) {
        throw linkError;
      }

      actionUrl = rewriteSupabaseActionRedirect(linkData.properties.action_link, existingAccountRedirectUrl);
      subject = "Continue to Thumora AI";
      idempotencyPrefix = "auth-existing";
      template = "continueAccount";
      emailAction = "sign_in";
    } else {
      actionUrl = rewriteSupabaseActionRedirect(signupData.properties.action_link, signupRedirectUrl);
    }

    if (!actionUrl) {
      throw new Error("Supabase did not return an auth link.");
    }

    await sendAuthActionEmail({
      to: email,
      subject,
      actionUrl,
      idempotencyPrefix,
      template,
    });

    res.status(200).json({ requiresEmailConfirmation: true, emailAction });
  } catch (error) {
    console.error("Failed to send signup confirmation email", error);
    respondWithAuthRouteError(res, error);
  }
}

export async function handleAuthMagicLink(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);

    const email = normalizeAuthEmail(req.body?.email);
    const mode = req.body?.mode === "signup" ? "signup" : "login";
    const marketingConsent = req.body?.marketingConsent === true;
    const acceptedTerms = req.body?.acceptedTerms === true;

    if (!isValidAuthEmail(email)) {
      respondWithAuthInputError(res, "Enter a valid email address.");
      return;
    }

    if (mode === "signup" && !acceptedTerms) {
      respondWithAuthInputError(res, "You must agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (!serverEnv.resendApiKey) {
      throw new Error("Email delivery is not configured.");
    }

    const appUrl = resolveAuthRedirectBaseUrl(req.headers);
    const magicLinkRedirectUrl = `${appUrl}/projects`;
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: { marketing_consent: marketingConsent },
        redirectTo: magicLinkRedirectUrl,
      },
    });

    if (error) {
      throw error;
    }

    await sendAuthActionEmail({
      to: email,
      subject: "Your Thumora AI sign-in link",
      actionUrl: rewriteSupabaseActionRedirect(data.properties.action_link, magicLinkRedirectUrl),
      idempotencyPrefix: "auth-magic-link",
      template: "magicLink",
      magicLinkMode: mode,
    });

    res.status(200).json({ sent: true });
  } catch (error) {
    console.error("Failed to send magic link email", error);
    respondWithAuthRouteError(res, error);
  }
}

export async function handleAuthPasswordReset(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);

    const email = normalizeAuthEmail(req.body?.email);

    if (!isValidAuthEmail(email)) {
      respondWithAuthInputError(res, "Enter a valid email address.");
      return;
    }

    if (!serverEnv.resendApiKey) {
      throw new Error("Email delivery is not configured.");
    }

    const appUrl = resolveAuthRedirectBaseUrl(req.headers);
    const recoveryRedirectUrl = `${appUrl}/settings/privacy?recovery=true`;
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: recoveryRedirectUrl,
      },
    });

    if (error) {
      if (isMissingUserAuthError(error)) {
        res.status(200).json({ sent: true });
        return;
      }

      throw error;
    }

    await sendAuthActionEmail({
      to: email,
      subject: "Reset your Thumora AI password",
      actionUrl: buildRecoveryActionUrl(appUrl, data.properties.hashed_token, data.properties.action_link, recoveryRedirectUrl),
      idempotencyPrefix: "auth-password-reset",
      template: "resetPassword",
    });

    res.status(200).json({ sent: true });
  } catch (error) {
    console.error("Failed to send password reset email", error);
    respondWithAuthRouteError(res, error);
  }
}

export async function handleCronOnboardingEmails(req: RequestLike, res: ResponseLike) {
  try {
    const authHeader = readHeader(req.headers, "authorization");
    if (authHeader !== `Bearer ${serverEnv.cronSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const appUrl = resolveAuthRedirectBaseUrl(req.headers);

    // 1. Get due jobs
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("onboarding_email_jobs")
      .select("*, profiles!inner(marketing_email_opt_in)")
      .eq("status", "pending")
      .lte("scheduled_for", now);

    if (jobsError) throw jobsError;

    // 2. Process jobs
    for (const job of (jobs as any[]) || []) {
      // Check marketing gate
      if (job.requires_marketing_opt_in && !job.profiles.marketing_email_opt_in) {
        await supabaseAdmin.from("onboarding_email_jobs").update({ status: 'sent', sent_at: now }).eq('id', job.id); // Skip
        continue;
      }

      // Send email
      const { sendEmail } = await import("./mailer.js");
      let emailTemplate: any;
      if (job.step_key === 'day1') emailTemplate = (await import("../emails/GettingStartedEmail.js")).GettingStartedEmail;
      else if (job.step_key === 'day3') emailTemplate = (await import("../emails/StudioTipsEmail.js")).StudioTipsEmail;
      else if (job.step_key === 'day7') emailTemplate = (await import("../emails/PowerUserEmail.js")).PowerUserEmail;

      if (emailTemplate) {
        try {
            const unsubscribeUrl = job.requires_marketing_opt_in ? buildMarketingUnsubscribeUrl(job.user_id, req.headers) : null;
            const res = await sendEmail({
                to: job.email,
                subject: job.subject,
                react: emailTemplate({ appUrl, unsubscribeUrl }),
                idempotencyKey: `onboarding-${job.user_id}-${job.step_key}`
            });
            await supabaseAdmin.from("onboarding_email_jobs")
                .update({ status: 'sent', sent_at: new Date().toISOString(), resend_email_id: res.data?.id })
                .eq('id', job.id);
        } catch (err: any) {
            console.error("Failed to send cron email", err);
            await supabaseAdmin.from("onboarding_email_jobs")
                .update({ status: 'failed', last_error: err.message })
                .eq('id', job.id);
        }
      }
    }

    res.status(200).json({ success: true, processed: jobs?.length || 0 });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleEmailUnsubscribe(req: RequestLike, res: ResponseLike) {
  try {
    const token = readQueryValue(req.query, "token");
    if (!token) throw new Error("Missing token");
    const secret = serverEnv.unsubscribeSecret;
    if (!secret) throw new Error("Unsubscribe is not configured.");

    // Verify token using secret
    const [payload, signature] = token.split(".");
    if (!payload || !signature) throw new Error("Invalid token");

    const expectedSignature = encodeBase64Url(createHmac("sha256", secret).update(payload).digest());
    if (!safeEqualString(signature, expectedSignature)) {
        throw new Error("Invalid token");
    }

    const { userId, purpose } = JSON.parse(decodeBase64Url(payload));
    if (!userId || purpose !== "marketing_unsubscribe") {
      throw new Error("Invalid token");
    }
    const supabaseAdmin = getSupabaseAdmin();

    await supabaseAdmin
        .from("profiles")
        .update({ marketing_email_opt_in: false, marketing_email_opt_out_at: new Date().toISOString() })
        .eq("id", userId);

    res.status(200).send("You have been unsubscribed.");
  } catch (error) {
    respondWithError(res, error);
  }
}


function parseStructuredError(message: string) {
  try {
    const parsed = JSON.parse(message);
    const errorValue = "error" in parsed ? (parsed as { error?: unknown }).error : null;

    if (typeof errorValue === "string") {
      return {
        message: errorValue,
        status: undefined,
        details: parsed,
      };
    }

    if (errorValue && typeof errorValue === "object") {
      const nestedMessage =
        "message" in errorValue && typeof (errorValue as { message?: unknown }).message === "string"
          ? (errorValue as { message: string }).message
          : message;
      const nestedCode =
        "code" in errorValue && typeof (errorValue as { code?: unknown }).code === "number"
          ? (errorValue as { code: number }).code
          : null;
      const nestedStatus =
        "status" in errorValue && typeof (errorValue as { status?: unknown }).status === "string"
          ? (errorValue as { status: string }).status
          : null;

      let status = nestedCode;
      if (!status) {
        if (nestedStatus === "INVALID_ARGUMENT") status = 400;
        else if (nestedStatus === "UNAUTHENTICATED") status = 401;
        else if (nestedStatus === "PERMISSION_DENIED") status = 403;
        else if (nestedStatus === "NOT_FOUND") status = 404;
        else if (nestedStatus === "RESOURCE_EXHAUSTED") status = 429;
      }

      return {
        message: nestedMessage,
        status,
        details: parsed,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isRateLimitedMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return [
    "resource has been exhausted",
    "resource_exhausted",
    "check quota",
    "quota",
    "rate limit",
    "too many requests",
  ].some((signal) => normalizedMessage.includes(signal));
}

function toClientSafeMessage(message: string, status: number): string {
  if (status === 429 || isRateLimitedMessage(message)) {
    return "AI generation is temporarily unavailable because the provider is busy or out of quota. Try again in a minute.";
  }
  if (status >= 500) return "An internal server error occurred.";
  return message;
}

function respondWithError(res: ResponseLike, error: unknown) {
  const rawMessage = getErrorMessage(error);
  const structuredError = parseStructuredError(rawMessage);
  const message = structuredError?.message || rawMessage;
  const normalizedMessage = message.toLowerCase();
  let status = structuredError?.status && structuredError.status >= 400 && structuredError.status < 600
    ? structuredError.status
    : 500;

  if (normalizedMessage.includes("bearer token") || normalizedMessage.includes("expired session")) {
    status = 401;
  } else if (normalizedMessage.includes("unauthorized")) {
    status = 401;
  } else if (normalizedMessage.includes("forbidden")) {
    status = 403;
  } else if (normalizedMessage.includes("storage titler webhook is not configured")) {
    status = 503;
  } else if (normalizedMessage.includes("free plan does not require checkout") || normalizedMessage.includes("invalid plan")) {
    status = 400;
  } else if (isRateLimitedMessage(message)) {
    status = 429;
  } else if (normalizedMessage.includes("missing whop plan mapping")) {
    status = 500;
  }

  res.status(status).json({
    error: toClientSafeMessage(message, status),
    ...(structuredError && status < 500 ? { details: structuredError.details } : {}),
  });
}

function readQueryValue(query: Record<string, unknown> | undefined, name: string) {
  const value = query?.[name];

  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value != null ? String(value) : null;
}

function extractYoutubeVideoId(url: string) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|img\.youtube\.com\/vi\/)([^&?/\n]{11})/);
  return match ? match[1] : null;
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function deriveTemplateTitleFromKey(sourceName: string) {
  const finalSegment = sourceName.split("/").filter(Boolean).pop() || sourceName;
  const derivedTitle = finalSegment
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

function buildSupabaseStoragePublicUrl(bucket: string, key: string) {
  if (!serverEnv.supabaseUrl) {
    return null;
  }

  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${serverEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedKey}`;
}

function isYoutubeOauthConfigured() {
  const isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  return Boolean(
    serverEnv.googleOauthClientId &&
      serverEnv.googleOauthClientSecret &&
      serverEnv.googleOauthStateSecret &&
      (serverEnv.appUrl || isLocal)
  );
}

function sanitizeReturnPath(value: unknown) {
  if (typeof value !== "string") {
    return "/settings/integrations";
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) {
    return "/settings/integrations";
  }

  return trimmed;
}

function getYoutubeCallbackUrl(req: RequestLike) {
  return `${resolveAuthRedirectBaseUrl(req.headers).replace(/\/$/, "")}/api/integrations/youtube/callback`;
}

function sanitizeReturnOrigin(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const isAllowedHost =
      hostname === "thumoraai.com" ||
      hostname === "www.thumoraai.com" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".vercel.app");

    if (!isAllowedHost) {
      return null;
    }

    if (hostname === "thumoraai.com") {
      url.hostname = "www.thumoraai.com";
    }

    return url.origin;
  } catch {
    return null;
  }
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signYoutubeOauthState(payload: SignedOauthState) {
  const secret = serverEnv.googleOauthStateSecret;

  if (!secret) {
    throw new Error("Google OAuth state secret is not configured.");
  }

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = encodeBase64Url(createHmac("sha256", secret).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
}

function verifyYoutubeOauthState(token: string) {
  const secret = serverEnv.googleOauthStateSecret;

  if (!secret) {
    throw new Error("Google OAuth state secret is not configured.");
  }

  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new Error("Invalid YouTube OAuth state.");
  }

  const expectedSignature = Buffer.from(
    encodeBase64Url(createHmac("sha256", secret).update(encodedPayload).digest()),
    "utf8"
  );
  const providedSignature = Buffer.from(encodedSignature, "utf8");

  if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error("Invalid YouTube OAuth state signature.");
  }

  const parsed = JSON.parse(decodeBase64Url(encodedPayload)) as SignedOauthState;

  if (!parsed.userId || !parsed.issuedAt || Date.now() - parsed.issuedAt > YOUTUBE_STATE_MAX_AGE_MS) {
    throw new Error("YouTube OAuth state has expired.");
  }

  return {
    userId: parsed.userId,
    returnPath: sanitizeReturnPath(parsed.returnPath),
    returnOrigin: sanitizeReturnOrigin(parsed.returnOrigin),
    issuedAt: parsed.issuedAt,
  };
}

function buildYoutubeRedirectUrl(req: RequestLike, returnPath: string, status: string, message?: string, returnOrigin?: string | null) {
  const baseUrl = sanitizeReturnOrigin(returnOrigin) || resolveRequestedAppUrl(req.headers) || resolveAppUrl(req.headers);
  const target = new URL(sanitizeReturnPath(returnPath), `${baseUrl.replace(/\/$/, "")}/`);
  target.searchParams.set("youtube", status);

  if (message) {
    target.searchParams.set("message", message);
  }

  return target.toString();
}

function requireYoutubeOauthSetup() {
  if (!isYoutubeOauthConfigured()) {
    throw new Error(
      "YouTube OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET, and a valid APP_URL on the server before enabling channel imports."
    );
  }
}

function isYoutubeReconnectRequiredMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("connect it again") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("expired") ||
    normalized.includes("revoked")
  );
}

function isYoutubeOauthCredentialMessage(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("provided client secret is invalid") ||
    normalized.includes("invalid client secret") ||
    normalized.includes("invalid_client") ||
    normalized.includes("client secret") ||
    normalized.includes("client id")
  );
}

function pickYoutubeThumbnail(thumbnails: Record<string, any> | undefined) {
  const candidates = [
    thumbnails?.maxres,
    thumbnails?.standard,
    thumbnails?.high,
    thumbnails?.medium,
    thumbnails?.default,
  ];

  return candidates.find((candidate) => typeof candidate?.url === "string")?.url ?? null;
}

function normalizeYoutubeChannel(channel: any): YoutubeChannelSummary {
  return {
    id: typeof channel?.id === "string" ? channel.id : "",
    title: typeof channel?.snippet?.title === "string" ? channel.snippet.title : "Untitled channel",
    handle: typeof channel?.snippet?.customUrl === "string" ? channel.snippet.customUrl : null,
    thumbnailUrl: pickYoutubeThumbnail(channel?.snippet?.thumbnails),
  };
}

function summarizeYoutubeIntegration(row: YoutubeIntegrationRow | null) {
  if (!row) {
    return {
      connected: false,
      googleAccountId: null,
      googleAccountEmail: null,
      scopes: [],
      selectedChannel: null,
      updatedAt: null,
    };
  }

  return {
    connected: true,
    googleAccountId: row.google_account_id,
    googleAccountEmail: row.google_account_email,
    scopes: row.scopes ?? [],
    selectedChannel: row.selected_channel_id
      ? {
          id: row.selected_channel_id,
          title: row.selected_channel_title || "Selected channel",
          handle: row.selected_channel_handle,
          thumbnailUrl: row.selected_channel_thumbnail_url,
        }
      : null,
    updatedAt: row.updated_at,
  };
}

async function getYoutubeIntegration(userId: string) {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("youtube_integrations")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // If the table doesn't exist yet, treat it as "no integration"
      const msg = getErrorMessage(error).toLowerCase();
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("undefined_table")) {
        console.warn("youtube_integrations table does not exist — treating as unconfigured.");
        return null;
      }

      throw error;
    }

    return (data as YoutubeIntegrationRow | null) ?? null;
  } catch (error) {
    const msg = getErrorMessage(error).toLowerCase();
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("undefined_table")) {
      console.warn("youtube_integrations table not found — treating as unconfigured.");
      return null;
    }

    throw error;
  }
}

async function upsertYoutubeIntegration(userId: string, values: Partial<YoutubeIntegrationRow>) {
  const supabase = getSupabaseAdmin();
  const payload = {
    user_id: userId,
    ...values,
  };

  const { data, error } = await supabase
    .from("youtube_integrations")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as YoutubeIntegrationRow;
}

async function deleteYoutubeIntegration(userId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("youtube_integrations").delete().eq("user_id", userId);

  if (error) {
    throw error;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => null)) as T | { error?: string | { message?: string }; error_description?: string } | null;

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    
    if (payload && typeof payload === "object") {
      if ("error_description" in payload && typeof payload.error_description === "string") {
        message = payload.error_description;
      } else if ("error" in payload) {
        if (typeof payload.error === "string") {
          message = payload.error;
        } else if (typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string") {
          message = payload.error.message;
        }
      }
    }

    throw new Error(message);
  }

  return payload as T;
}

async function exchangeGoogleToken(params: URLSearchParams) {
  return fetchJson<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
  }>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
}

async function refreshYoutubeAccessToken(row: YoutubeIntegrationRow) {
  if (!row.refresh_token) {
    await deleteYoutubeIntegration(row.user_id);
    throw new Error("Your YouTube connection expired. Connect it again.");
  }

  try {
    const refreshed = await exchangeGoogleToken(
      new URLSearchParams({
        client_id: serverEnv.googleOauthClientId || "",
        client_secret: serverEnv.googleOauthClientSecret || "",
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
      })
    );

    const nextScopes = refreshed.scope
      ? refreshed.scope.split(" ").filter(Boolean)
      : row.scopes ?? YOUTUBE_OAUTH_SCOPES;
    const updatedRow = await upsertYoutubeIntegration(row.user_id, {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || row.refresh_token,
      token_expires_at:
        typeof refreshed.expires_in === "number"
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : row.token_expires_at,
      scopes: nextScopes,
    });

    return updatedRow;
  } catch (error) {
    const message = getErrorMessage(error).toLowerCase();

    if (message.includes("invalid_grant")) {
      await deleteYoutubeIntegration(row.user_id);
      throw new Error("Your YouTube connection expired. Connect it again.");
    }

    throw error;
  }
}

async function ensureYoutubeAccessToken(row: YoutubeIntegrationRow) {
  if (!row.access_token) {
    throw new Error("Your YouTube connection is incomplete. Disconnect it and connect again.");
  }

  const expiryMs = row.token_expires_at ? Date.parse(row.token_expires_at) : Number.NaN;
  if (Number.isFinite(expiryMs) && expiryMs - Date.now() <= 60_000) {
    return refreshYoutubeAccessToken(row);
  }

  return row;
}

async function fetchYoutubeUserInfo(accessToken: string) {
  return fetchJson<{
    sub?: string;
    email?: string;
  }>("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function fetchYoutubeChannels(accessToken: string) {
  const response = await fetchJson<{
    items?: any[];
  }>("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return (response.items ?? []).map(normalizeYoutubeChannel).filter((channel) => channel.id);
}

async function fetchYoutubeVideos(
  accessToken: string,
  channelId: string,
  query: string,
  pageToken: string | null,
  maxResults: number
) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("maxResults", String(maxResults));

  if (query) {
    url.searchParams.set("q", query);
  }

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetchJson<{
    nextPageToken?: string;
    prevPageToken?: string;
    items?: any[];
  }>(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const videos: YoutubeVideoSummary[] = (response.items ?? [])
    .map((item) => ({
      id: typeof item?.id?.videoId === "string" ? item.id.videoId : "",
      title: typeof item?.snippet?.title === "string" ? item.snippet.title : "Untitled video",
      publishedAt: typeof item?.snippet?.publishedAt === "string" ? item.snippet.publishedAt : new Date().toISOString(),
      thumbnailUrl: pickYoutubeThumbnail(item?.snippet?.thumbnails) || "",
    }))
    .filter((item) => item.id && item.thumbnailUrl);

  return {
    videos,
    nextPageToken: response.nextPageToken ?? null,
    prevPageToken: response.prevPageToken ?? null,
  };
}

async function buildYoutubeIntegrationStatus(userId: string): Promise<YoutubeIntegrationStatus> {
  const notConfigured: YoutubeIntegrationStatus = {
    configured: false,
    connected: false,
    account: null,
    selectedChannel: null,
    availableChannels: [],
    scopes: [],
  };

  if (!isYoutubeOauthConfigured()) {
    return notConfigured;
  }

  let stored: YoutubeIntegrationRow | null;
  try {
    stored = await getYoutubeIntegration(userId);
  } catch (error) {
    console.error("Failed to query youtube_integrations table:", getErrorMessage(error));
    return notConfigured;
  }

  if (!stored) {
    return {
      configured: true,
      connected: false,
      account: null,
      selectedChannel: null,
      availableChannels: [],
      scopes: [],
    };
  }

  // Token refresh and channel fetch can fail for transient reasons.
  // Degrade gracefully instead of crashing the entire status endpoint.
  let refreshed: YoutubeIntegrationRow;
  try {
    refreshed = await ensureYoutubeAccessToken(stored);
  } catch (error) {
    const rawMessage = getErrorMessage(error);
    const msg = rawMessage.toLowerCase();
    // If the token is fully expired / revoked, surface a disconnected state
    if (isYoutubeReconnectRequiredMessage(msg)) {
      return {
        configured: true,
        connected: false,
        account: null,
        selectedChannel: null,
        availableChannels: [],
        scopes: [],
      };
    }
    if (isYoutubeOauthCredentialMessage(msg)) {
      console.error("YouTube OAuth server credentials are invalid:", rawMessage);
      return notConfigured;
    }
    console.error("Failed to refresh YouTube access token:", msg);
    // Return connected but with empty channel list rather than crashing
    return {
      configured: true,
      connected: true,
      account: {
        googleAccountId: stored.google_account_id,
        googleAccountEmail: stored.google_account_email,
      },
      selectedChannel: stored.selected_channel_id
        ? {
            id: stored.selected_channel_id,
            title: stored.selected_channel_title || "Selected channel",
            handle: stored.selected_channel_handle,
            thumbnailUrl: stored.selected_channel_thumbnail_url,
          }
        : null,
      availableChannels: [],
      scopes: stored.scopes ?? [],
    };
  }

  let availableChannels: YoutubeChannelSummary[] = [];
  try {
    availableChannels = await fetchYoutubeChannels(refreshed.access_token || "");
  } catch (error) {
    console.error("Failed to fetch YouTube channels:", getErrorMessage(error));
    // Continue with empty channel list instead of crashing
  }

  const matchingSelectedChannel = refreshed.selected_channel_id
    ? availableChannels.find((channel) => channel.id === refreshed.selected_channel_id) || null
    : null;

  if (
    matchingSelectedChannel &&
    (matchingSelectedChannel.title !== refreshed.selected_channel_title ||
      matchingSelectedChannel.handle !== refreshed.selected_channel_handle ||
      matchingSelectedChannel.thumbnailUrl !== refreshed.selected_channel_thumbnail_url)
  ) {
    try {
      await upsertYoutubeIntegration(userId, {
        selected_channel_title: matchingSelectedChannel.title,
        selected_channel_handle: matchingSelectedChannel.handle,
        selected_channel_thumbnail_url: matchingSelectedChannel.thumbnailUrl,
      });
    } catch (error) {
      console.error("Failed to sync channel metadata:", getErrorMessage(error));
    }
  }

  return {
    configured: true,
    connected: true,
    account: {
      googleAccountId: refreshed.google_account_id,
      googleAccountEmail: refreshed.google_account_email,
    },
    selectedChannel:
      matchingSelectedChannel ||
      (refreshed.selected_channel_id
        ? {
            id: refreshed.selected_channel_id,
            title: refreshed.selected_channel_title || "Selected channel",
            handle: refreshed.selected_channel_handle,
            thumbnailUrl: refreshed.selected_channel_thumbnail_url,
          }
        : null),
    availableChannels,
    scopes: refreshed.scopes ?? [],
  };
}
/* Deleted duplicate handleAccountOnboarding */

export async function handleBillingUsage(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const period = String(req.query?.period || "cycle");
    const data = await getUsageHistory(user.id, period);
    res.json(data);
  } catch (error) {
    console.error("Billing Usage Error:", error);
    respondWithError(res, error);
  }
}

export async function handleBillingMe(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const billing = await getBillingSnapshotForUser(user.id);
    res.status(200).json({ billing });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleBillingCheckout(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const planKey = typeof req.body?.planKey === "string" ? req.body.planKey : null;
    const returnPath = typeof req.body?.returnPath === "string" ? req.body.returnPath : null;

    if (!planKey) {
      res.status(400).json({ error: "planKey is required." });
      return;
    }

    const checkout = await createCheckoutForUser({
      userId: user.id,
      email: user.email || null,
      planKey: planKey as any,
      requestHeaders: req.headers,
      returnPath,
    });

    res.status(200).json(checkout);
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAccountExport(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const supabase = getSupabaseAdmin();

    const [billingSnapshot, profileResult, membershipsResult, creditLedgerResult, assetsResult, generationsResult, draftsResult, youtubeIntegration] =
      await Promise.all([
        getBillingSnapshotForUser(user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("billing_memberships").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("credit_ledger").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("assets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("generations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("drafts").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
        getYoutubeIntegration(user.id),
      ]);

    for (const result of [profileResult, membershipsResult, creditLedgerResult, assetsResult, generationsResult, draftsResult]) {
      if (result.error) {
        throw result.error;
      }
    }

    const exportPayload: AccountExportPayload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email || profileResult.data?.email || null,
        displayName:
          profileResult.data?.display_name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.name ||
          null,
        avatarUrl:
          profileResult.data?.avatar_url ||
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null,
        updatedAt: profileResult.data?.updated_at || null,
      },
      billingSnapshot,
      billingMemberships: (membershipsResult.data ?? []) as Record<string, unknown>[],
      creditLedger: (creditLedgerResult.data ?? []) as Record<string, unknown>[],
      assets: (assetsResult.data ?? []) as Record<string, unknown>[],
      generations: (generationsResult.data ?? []) as Record<string, unknown>[],
      drafts: (draftsResult.data ?? []) as Record<string, unknown>[],
      youtubeIntegration: summarizeYoutubeIntegration(youtubeIntegration),
    };

    if (res.setHeader) {
      const dateLabel = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Disposition", `attachment; filename=\"thumora-account-export-${dateLabel}.json\"`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    res.status(200).json(exportPayload);
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleYoutubeIntegrationStart(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    requireYoutubeOauthSetup();
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const returnPath = sanitizeReturnPath(req.body?.returnPath);
    const state = signYoutubeOauthState({
      userId: user.id,
      returnPath,
      returnOrigin: resolveRequestedAppUrl(req.headers),
      issuedAt: Date.now(),
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", serverEnv.googleOauthClientId || "");
    authUrl.searchParams.set("redirect_uri", getYoutubeCallbackUrl(req));
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent select_account");
    authUrl.searchParams.set("scope", YOUTUBE_OAUTH_SCOPES.join(" "));
    authUrl.searchParams.set("state", state);

    res.status(200).json({
      url: authUrl.toString(),
    });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleYoutubeOauthCallback(req: RequestLike, res: ResponseLike) {
  let returnPath = "/settings/integrations";
  let returnOrigin: string | null = null;

  try {
    applySecurityHeaders(res);
    requireYoutubeOauthSetup();
    const stateToken = readQueryValue(req.query, "state");

    if (!stateToken) {
      throw new Error("Missing YouTube OAuth state.");
    }

    const state = verifyYoutubeOauthState(stateToken);
    returnPath = state.returnPath;
    returnOrigin = state.returnOrigin;

    const oauthError = readQueryValue(req.query, "error");
    if (oauthError) {
      const deniedRedirect = buildYoutubeRedirectUrl(req, returnPath, "error", "Google access was not granted.", returnOrigin);
      if (res.redirect) {
        res.redirect(deniedRedirect);
        return;
      }

      res.status(302).json({ redirect: deniedRedirect });
      return;
    }

    const code = readQueryValue(req.query, "code");

    if (!code) {
      throw new Error("Missing Google authorization code.");
    }

    const existingIntegration = await getYoutubeIntegration(state.userId);
    const tokenPayload = await exchangeGoogleToken(
      new URLSearchParams({
        client_id: serverEnv.googleOauthClientId || "",
        client_secret: serverEnv.googleOauthClientSecret || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: getYoutubeCallbackUrl(req),
      })
    );
    const userInfo = await fetchYoutubeUserInfo(tokenPayload.access_token);

    await upsertYoutubeIntegration(state.userId, {
      google_account_id: userInfo.sub ?? existingIntegration?.google_account_id ?? null,
      google_account_email: userInfo.email ?? existingIntegration?.google_account_email ?? null,
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token || existingIntegration?.refresh_token || null,
      token_expires_at:
        typeof tokenPayload.expires_in === "number"
          ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
          : existingIntegration?.token_expires_at ?? null,
      scopes: tokenPayload.scope ? tokenPayload.scope.split(" ").filter(Boolean) : YOUTUBE_OAUTH_SCOPES,
      selected_channel_id: null,
      selected_channel_title: null,
      selected_channel_handle: null,
      selected_channel_thumbnail_url: null,
    });

    const successRedirect = buildYoutubeRedirectUrl(req, returnPath, "connected", undefined, returnOrigin);
    if (res.redirect) {
      res.redirect(successRedirect);
      return;
    }

    res.status(302).json({ redirect: successRedirect });
  } catch (error) {
    const failureRedirect = buildYoutubeRedirectUrl(
      req,
      returnPath,
      "error",
      getErrorMessage(error),
      returnOrigin
    );

    if (res.redirect) {
      res.redirect(failureRedirect);
      return;
    }

    res.status(302).json({ redirect: failureRedirect });
  }
}

export async function handleYoutubeIntegrationStatus(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));

    try {
      const status = await buildYoutubeIntegrationStatus(user.id);
      res.status(200).json(status);
    } catch (error) {
      // Gracefully degrade: any failure building YouTube status should not produce a 500.
      // Log the real error server-side for debugging, but return a safe fallback to the client.
      console.error("YouTube integration status failed, returning fallback:", getErrorMessage(error));
      const fallbackState: YoutubeIntegrationStatus = {
        configured: isYoutubeOauthConfigured(),
        connected: false,
        account: null,
        selectedChannel: null,
        availableChannels: [],
        scopes: [],
      };
      res.status(200).json(fallbackState);
    }
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleYoutubeIntegrationChannel(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    requireYoutubeOauthSetup();
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const channelId = typeof req.body?.channelId === "string" ? req.body.channelId.trim() : "";

    if (!channelId) {
      res.status(400).json({ error: "channelId is required." });
      return;
    }

    const status = await buildYoutubeIntegrationStatus(user.id);

    if (!status.connected) {
      res.status(400).json({ error: "Connect a YouTube account first." });
      return;
    }

    const channel = status.availableChannels.find((item) => item.id === channelId);

    if (!channel) {
      res.status(404).json({ error: "Selected channel was not found for this Google account." });
      return;
    }

    await upsertYoutubeIntegration(user.id, {
      selected_channel_id: channel.id,
      selected_channel_title: channel.title,
      selected_channel_handle: channel.handle,
      selected_channel_thumbnail_url: channel.thumbnailUrl,
    });

    const nextStatus = await buildYoutubeIntegrationStatus(user.id);
    res.status(200).json(nextStatus);
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleYoutubeIntegrationDisconnect(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    await deleteYoutubeIntegration(user.id);
    res.status(200).json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleYoutubeIntegrationVideos(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const query = (readQueryValue(req.query, "query") || "").trim();
    const pageToken = (readQueryValue(req.query, "pageToken") || "").trim() || null;
    const requestedLimit = Number.parseInt(readQueryValue(req.query, "limit") || "12", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(24, requestedLimit)) : 12;

    if (!isYoutubeOauthConfigured()) {
      const notConfigured: YoutubeVideosResponse = {
        configured: false,
        connected: false,
        query,
        selectedChannel: null,
        videos: [],
        nextPageToken: null,
        prevPageToken: null,
      };
      res.status(200).json(notConfigured);
      return;
    }

    const stored = await getYoutubeIntegration(user.id);

    if (!stored) {
      const disconnected: YoutubeVideosResponse = {
        configured: true,
        connected: false,
        query,
        selectedChannel: null,
        videos: [],
        nextPageToken: null,
        prevPageToken: null,
      };
      res.status(200).json(disconnected);
      return;
    }

    const refreshed = await ensureYoutubeAccessToken(stored);

    if (!refreshed.selected_channel_id) {
      res.status(400).json({ error: "Select a YouTube channel before browsing videos." });
      return;
    }

    const { videos, nextPageToken, prevPageToken } = await fetchYoutubeVideos(
      refreshed.access_token || "",
      refreshed.selected_channel_id,
      query,
      pageToken,
      limit
    );
    const payload: YoutubeVideosResponse = {
      configured: true,
      connected: true,
      query,
      selectedChannel: {
        id: refreshed.selected_channel_id,
        title: refreshed.selected_channel_title || "Selected channel",
        handle: refreshed.selected_channel_handle,
        thumbnailUrl: refreshed.selected_channel_thumbnail_url,
      },
      videos,
      nextPageToken,
      prevPageToken,
    };

    res.status(200).json(payload);
  } catch (error) {
    const rawMessage = getErrorMessage(error);
    const normalizedMessage = rawMessage.toLowerCase();

    if (isYoutubeReconnectRequiredMessage(normalizedMessage)) {
      const disconnected: YoutubeVideosResponse = {
        configured: isYoutubeOauthConfigured(),
        connected: false,
        query: (readQueryValue(req.query, "query") || "").trim(),
        selectedChannel: null,
        videos: [],
        nextPageToken: null,
        prevPageToken: null,
      };
      res.status(200).json(disconnected);
      return;
    }
    if (isYoutubeOauthCredentialMessage(normalizedMessage)) {
      const notConfigured: YoutubeVideosResponse = {
        configured: false,
        connected: false,
        query: (readQueryValue(req.query, "query") || "").trim(),
        selectedChannel: null,
        videos: [],
        nextPageToken: null,
        prevPageToken: null,
      };
      res.status(200).json(notConfigured);
      return;
    }

    respondWithError(res, error);
  }
}

export async function handleAiClarify(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    await requireAuthenticatedUser(readHeader(req.headers, "authorization"));

    const { prompt, baseImage, memory } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Missing required field: prompt" });
      return;
    }

    const clarification = await clarifyPromptOnServer({
      prompt,
      baseImage,
      memory,
      aspectRatio: req.body?.aspectRatio === "9:16" || req.body?.aspectRatio === "1:1" ? req.body.aspectRatio : "16:9",
      targetPlatform:
        req.body?.targetPlatform === "tiktok" || req.body?.targetPlatform === "instagram" || req.body?.targetPlatform === "youtube"
          ? req.body.targetPlatform
          : "youtube",
      targetFormat: typeof req.body?.targetFormat === "string" ? req.body.targetFormat.slice(0, 80) : undefined,
    });
    res.json(clarification);
  } catch (error) {
    console.error("AI Clarify Error:", error);
    respondWithError(res, error);
  }
}

export async function handleAiGenerate(req: RequestLike, res: ResponseLike) {
  let userId: string | null = null;
  let requestId: string | null = null;

  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    userId = user.id;

    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

    if (!prompt) {
      res.status(400).json({ error: "prompt is required." });
      return;
    }

    const billingBefore = await getBillingSnapshotForUser(user.id);
    if (!billingBefore.canGenerate) {
      res.status(402).json({
        error: "You are out of credits. Upgrade your plan or buy a top-up pack to continue.",
        billing: billingBefore,
      });
      return;
    }

    requestId = randomUUID();
    const ALLOWED_MODELS = new Set(SUPPORTED_IMAGE_MODELS.map((option) => option.id));
    const requestedModel = typeof req.body?.model === "string" ? resolveGeminiImageModelId(req.body.model) : "";
    const modelUsed = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_GEMINI_IMAGE_MODEL;
    const consumed = await consumeOneCredit(user.id, requestId, { model: modelUsed });
    if (!consumed) {
      const billing = await getBillingSnapshotForUser(user.id);
      res.status(402).json({
        error: "You are out of credits. Upgrade your plan or buy a top-up pack to continue.",
        billing,
      });
      return;
    }

    const images = await generateImagesOnServer({
      prompt,
      imageSize: req.body?.imageSize === "2K" || req.body?.imageSize === "4K" ? req.body.imageSize : "1K",
      aspectRatio:
        req.body?.aspectRatio === "9:16" || req.body?.aspectRatio === "1:1" ? req.body.aspectRatio : "16:9",
      targetPlatform:
        req.body?.targetPlatform === "tiktok" || req.body?.targetPlatform === "instagram" || req.body?.targetPlatform === "youtube"
          ? req.body.targetPlatform
          : "youtube",
      targetFormat: typeof req.body?.targetFormat === "string" ? req.body.targetFormat.slice(0, 80) : undefined,
      instructions: typeof req.body?.instructions === "string" ? req.body.instructions : undefined,
      styleJson: typeof req.body?.styleJson === "string" ? req.body.styleJson : undefined,
      model: modelUsed,
      baseImage: typeof req.body?.baseImage === "string" ? req.body.baseImage : undefined,
      referenceImage: typeof req.body?.referenceImage === "string" ? req.body.referenceImage : undefined,
      referenceImagePurpose:
        req.body?.referenceImagePurpose === "mask" || req.body?.referenceImagePurpose === "subject"
          ? req.body.referenceImagePurpose
          : undefined,
      intent:
        req.body?.intent === "edit" || req.body?.intent === "create" || req.body?.intent === "background_only"
          ? req.body.intent
          : undefined,
      allowVisibleText: Boolean(req.body?.allowVisibleText),
      background:
        req.body?.background === "transparent" || req.body?.background === "opaque" || req.body?.background === "auto"
          ? req.body.background
          : undefined,
    });

    const billing = await getBillingSnapshotForUser(user.id);
    res.status(200).json({ images, billing });
  } catch (error) {
    if (userId && requestId) {
      try {
        await refundConsumedCredit(userId, requestId, error instanceof Error ? error.message : "Generation failed");
      } catch (refundError) {
        console.error("Failed to refund consumed credit", refundError);
      }
    }

    respondWithError(res, error);
  }
}

export async function handleAiAnalyze(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : undefined;

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required." });
      return;
    }

    const analysis = await analyzeImageOnServer(imageUrl, prompt);
    res.status(200).json({ analysis });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiIdeas(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    await requireAuthenticatedUser(readHeader(req.headers, "authorization"));

    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";

    if (!topic) {
      res.status(400).json({ error: "topic is required." });
      return;
    }

    const ideas = await generateThumbnailIdeasOnServer({
      topic,
      category: typeof req.body?.category === "string" ? req.body.category : undefined,
      goal: typeof req.body?.goal === "string" ? req.body.goal : undefined,
      visualVibe: typeof req.body?.visualVibe === "string" ? req.body.visualVibe : undefined,
      startMode: req.body?.startMode === "sketch" ? "sketch" : "blank",
      referenceImage: typeof req.body?.referenceImage === "string" ? req.body.referenceImage : undefined,
    });

    res.status(200).json(ideas);
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiAutoTitle(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    await requireAuthenticatedUser(readHeader(req.headers, "authorization"));

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const currentTitle = typeof req.body?.currentTitle === "string" ? req.body.currentTitle.trim() : "";
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required." });
      return;
    }

    const title = await generateViralTitleFromImage(imageUrl, { currentTitle, prompt });
    res.status(200).json({ title });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiCtrScore(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requirePaidOptimizationUser(req, res);
    if (!user) return;

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required." });
      return;
    }

    const estimate = await scoreThumbnailCtrOnServer({ imageUrl, title });
    res.status(200).json({ estimate });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiOptimizationPack(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requirePaidOptimizationUser(req, res);
    if (!user) return;
    if (!(await ensureGrowthSchemaAvailable(res))) return;

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const patternKey = normalizeGrowthPatternKey(req.body?.patternKey);

    if (!title) {
      res.status(400).json({ error: "title is required." });
      return;
    }

    const variants = await generateOptimizationPackOnServer({
      title,
      baseImage: imageUrl.startsWith("data:image/") ? imageUrl : undefined,
      patternKey,
    });
    const experiment = await persistGrowthExperiment({
      userId: user.id,
      title: `${title} optimization pack`,
      sourceTitle: title,
      sourceImageUrl: imageUrl || null,
      experimentType: "optimization_pack",
      analysis: {
        patternKey,
        requestedAt: new Date().toISOString(),
      },
      variants,
    });

    res.status(200).json({ experiment });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiFaceOptimize(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requirePaidOptimizationUser(req, res);
    if (!user) return;
    if (!(await ensureGrowthSchemaAvailable(res))) return;

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "Smart face optimization";

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required." });
      return;
    }

    if (!imageUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "imageUrl must be a base64 image data URL for face optimization." });
      return;
    }

    const result = await optimizeFaceOnServer({ baseImage: imageUrl, title });
    const impressions = 3400 + result.ctrEstimate.score * 21;
    const experiment = await persistGrowthExperiment({
      userId: user.id,
      title: `${title} face optimization`,
      sourceTitle: title,
      sourceImageUrl: imageUrl,
      experimentType: "face_optimize",
      analysis: result.ctrEstimate.analysis,
      variants: [
        {
          title: "Smart face optimized",
          prompt: result.prompt,
          imageDataUrl: result.imageDataUrl,
          ctrEstimate: result.ctrEstimate,
          mockMetrics: {
            impressions,
            clicks: Math.round(impressions * Math.max(0.02, result.ctrEstimate.score / 1000)),
            ctr: Number(Math.max(2, result.ctrEstimate.score / 10).toFixed(2)),
            watchTimeLift: Number(((result.ctrEstimate.score - 60) / 8).toFixed(1)),
          },
          metricsSource: "mock",
          externalVideoId: null,
          patternKey: null,
          status: "draft",
        },
      ],
    });

    res.status(200).json({ experiment, variant: experiment.variants[0] });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleAiViralPattern(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requirePaidOptimizationUser(req, res);
    if (!user) return;
    if (!(await ensureGrowthSchemaAvailable(res))) return;

    const imageUrl = typeof req.body?.imageUrl === "string" ? req.body.imageUrl.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "Viral pattern variant";
    const patternKey = normalizeGrowthPatternKey(req.body?.patternKey);

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl is required." });
      return;
    }

    if (!imageUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "imageUrl must be a base64 image data URL for viral pattern edits." });
      return;
    }

    if (!patternKey) {
      res.status(400).json({ error: "patternKey is required." });
      return;
    }

    const result = await applyViralPatternOnServer({ baseImage: imageUrl, title, patternKey });
    const impressions = 2800 + result.ctrEstimate.score * 26;
    const experiment = await persistGrowthExperiment({
      userId: user.id,
      title: `${title} pattern variant`,
      sourceTitle: title,
      sourceImageUrl: imageUrl,
      experimentType: "viral_pattern",
      analysis: result.ctrEstimate.analysis,
      variants: [
        {
          title,
          prompt: result.prompt,
          imageDataUrl: result.imageDataUrl,
          ctrEstimate: result.ctrEstimate,
          mockMetrics: {
            impressions,
            clicks: Math.round(impressions * Math.max(0.02, result.ctrEstimate.score / 1000)),
            ctr: Number(Math.max(2, result.ctrEstimate.score / 10).toFixed(2)),
            watchTimeLift: Number(((result.ctrEstimate.score - 58) / 7).toFixed(1)),
          },
          metricsSource: "mock",
          externalVideoId: null,
          patternKey,
          status: "draft",
        },
      ],
    });

    res.status(200).json({ experiment, variant: experiment.variants[0] });
  } catch (error) {
    respondWithError(res, error);
  }
}

/**
 * YouTube returns a small 120×90 (or 1×1) gray placeholder image when a video
 * does not have a high-resolution thumbnail. Detect this by parsing the JPEG SOF
 * (Start Of Frame) marker to read the actual image dimensions.
 */
function isYoutubePlaceholderImage(buffer: Buffer): boolean {
  // Walk the JPEG markers looking for SOF0 (0xC0) or SOF2 (0xC2)
  let offset = 2; // Skip the SOI marker (0xFF 0xD8)
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    // SOF markers that contain image dimensions
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      // YouTube placeholder is 120×90 or 1×1
      return (width <= 120 && height <= 90) || (width === 1 && height === 1);
    }
    offset += 2 + length;
  }
  return false;
}

export async function handleYoutubeThumbnail(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    
    let parsedBody = req.body;
    if (typeof req.body === "string") {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {
        // ignore
      }
    }

    const url = typeof parsedBody?.url === "string" ? parsedBody.url.trim() : "";
    const directVideoId = typeof parsedBody?.videoId === "string" ? parsedBody.videoId.trim() : "";

    if ((url ? 1 : 0) + (directVideoId ? 1 : 0) !== 1) {
      res.status(400).json({ error: "Provide exactly one of url or videoId." });
      return;
    }

    const videoId = directVideoId || extractYoutubeVideoId(url);

    if (!videoId) {
      res.status(400).json({ error: url ? "Invalid YouTube URL. Could not find video ID." : "Invalid YouTube video ID." });
      return;
    }

    // Try fetching the highest available resolution, falling back to lower ones if not available.
    // YouTube returns a 120×90 gray placeholder for maxresdefault when no HD thumbnail exists —
    // skip those by checking JPEG dimensions before accepting the result.
    const qualities = ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg'];
    let base64Image = null;

    for (const quality of qualities) {
      const fetchUrl = `https://img.youtube.com/vi/${videoId}/${quality}`;
      const response = await fetch(fetchUrl);
      if (!response.ok) continue;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // YouTube's "image not available" placeholder is always 120×90 (or 1×1).
      // Detect this by reading the JPEG SOF0/SOF2 marker to get image dimensions.
      const isPlaceholder = isYoutubePlaceholderImage(buffer);
      if (isPlaceholder && quality !== 'hqdefault.jpg') {
        // Skip placeholder, try next quality
        continue;
      }

      base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      break;
    }

    if (!base64Image) {
      res.status(404).json({ error: "Could not fetch a thumbnail for this video." });
      return;
    }

    res.status(200).json({ base64: base64Image, videoId });
  } catch (error) {
    respondWithError(res, error);
  }
}

function requireStorageTitlerAccess(req: RequestLike) {
  const expectedSecret = serverEnv.storageTitlerSecret;

  if (!expectedSecret) {
    throw new Error("Storage titler webhook is not configured.");
  }

  const authHeader = readHeader(req.headers, "authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : null;
  const headerToken = readHeader(req.headers, "x-storage-titler-secret");
  const providedSecret = bearerToken || headerToken || "";

  if (!providedSecret || !safeEqualString(providedSecret, expectedSecret)) {
    throw new Error("Unauthorized storage titler request.");
  }
}

export async function handleStorageTitler(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireStorageTitlerAccess(req);
    const body = req.body ?? {};
    const record = body.record ?? body.new ?? body.object ?? {};
    const bucket =
      readFirstString(body.bucket, body.bucketName, record.bucket_id, record.bucket, record.bucket_name) || "thumbnails";
    const key = readFirstString(body.fileName, body.name, body.key, body.path, record.name, record.path);
    const explicitImageUrl = readFirstString(
      body.imageUrl,
      body.url,
      body.publicUrl,
      body.public_url,
      record.image_url,
      record.publicUrl,
      record.public_url,
      record.url
    );
    const imageUrl = explicitImageUrl || (key ? buildSupabaseStoragePublicUrl(bucket, key) : null);

    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl or storage object name is required." });
      return;
    }

    let title = deriveTemplateTitleFromKey(key || imageUrl);
    try {
      title = await generateViralTitleFromImage(imageUrl);
    } catch (error) {
      console.error("Failed to generate storage title, using filename fallback", getErrorMessage(error));
    }

    let template = null;
    if (bucket === "thumbnails") {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: existingTemplate, error: existingError } = await supabaseAdmin
        .from("templates")
        .select("*")
        .eq("image_url", imageUrl)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingTemplate) {
        const shouldRefreshTitle = body.forceTitle === true || existingTemplate.title === "Untitled Template";
        if (shouldRefreshTitle) {
          const { data, error } = await supabaseAdmin
            .from("templates")
            .update({ title })
            .eq("id", existingTemplate.id)
            .select("*")
            .single();

          if (error) {
            throw error;
          }

          template = data;
        } else {
          template = existingTemplate;
        }
      } else {
        const { data, error } = await supabaseAdmin
          .from("templates")
          .insert({
            title,
            image_url: imageUrl,
            category: "general",
            tags: [],
            is_new: true,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        template = data;
      }
    }

    res.status(200).json({ title, template });
  } catch (error) {
    respondWithError(res, error);
  }
}

export async function handleWhopWebhook(rawBody: string, headers: Record<string, unknown> | undefined, res: ResponseLike) {
  try {
    const event = getWhopClient().webhooks.unwrap(rawBody, {
      headers: normalizeHeaderRecord(headers),
      key: getWhopWebhookKey(),
    });

    await handleWhopWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Failed to process Whop webhook", error);
    respondWithError(res, error);
  }
}

export async function handleDeleteAccount(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const supabase = getSupabaseAdmin();

    // 1. Cancel active subscriptions on Whop
    await cancelAllUserMemberships(user.id);

    // 2. Delete files in Storage
    // Function to empty a user's directory in a specific bucket
    const emptyUserDirectory = async (bucket: string, prefix: string) => {
      const { data: files } = await supabase.storage.from(bucket).list(prefix);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${prefix}/${f.name}`);
        await supabase.storage.from(bucket).remove(paths);
      }
    };

    try {
      await emptyUserDirectory("thumbnails", `avatars/${user.id}`);
      await emptyUserDirectory("user-assets", `${user.id}`);
    } catch (storageError) {
      console.error(`Failed to delete storage files for user ${user.id}:`, storageError);
      // We continue with deletion even if storage cleanup fails partially
    }

    // 3. Delete User from Auth (This cascades and deletes all Postgres database records)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw new Error(`Failed to delete user: ${deleteError.message}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to delete account", error);
    respondWithError(res, error);
  }
}


export async function handleAccountOnboarding(req: RequestLike, res: ResponseLike) {
  try {
    applySecurityHeaders(res);
    requireSecureOrigin(req);
    const user = await requireAuthenticatedUser(readHeader(req.headers, "authorization"));
    const { marketingConsent, signupSource } = req.body ?? {};

    const supabaseAdmin = getSupabaseAdmin();
    const appUrl = resolveAuthRedirectBaseUrl(req.headers);

    // 1. Get existing profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    // 2. Resolve consent
    const alreadyOptedIn = profile?.marketing_email_opt_in ?? false;
    const newOptIn = marketingConsent === true;
    const finalOptIn = newOptIn || alreadyOptedIn;

    // 3. Update profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id,
        marketing_email_opt_in: finalOptIn,
        marketing_email_opt_in_at: finalOptIn ? new Date().toISOString() : null,
        signup_source: signupSource ?? profile?.signup_source ?? "unknown",
        onboarding_initialized_at: new Date().toISOString(),
      });

    if (updateError) throw updateError;

    // 4. Insert onboarding jobs (Welcome, Day 1, Day 3, Day 7)
    // Send welcome immediately
    const now = new Date();
    const jobs = [
        { user_id: user.id, email: user.email, step_key: 'welcome', subject: 'Welcome to Thumora AI', scheduled_for: now.toISOString(), requires_marketing_opt_in: false },
        { user_id: user.id, email: user.email, step_key: 'day1', subject: 'Getting started tips', scheduled_for: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), requires_marketing_opt_in: true },
        { user_id: user.id, email: user.email, step_key: 'day3', subject: 'Studio tips', scheduled_for: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), requires_marketing_opt_in: true },
        { user_id: user.id, email: user.email, step_key: 'day7', subject: 'Power user tips', scheduled_for: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), requires_marketing_opt_in: true }
    ];

    const { error: jobsError } = await supabaseAdmin
        .from("onboarding_email_jobs")
        .upsert(jobs, { onConflict: "user_id, step_key" });

    if (jobsError) throw jobsError;

    // 5. Send Welcome Email
    import("./mailer.js").then(({ sendEmail }) => {
        import("../emails/WelcomeEmail.js").then(({ WelcomeEmail }) => {
            sendEmail({
                to: user.email!,
                subject: 'Welcome to Thumora AI',
                react: WelcomeEmail({ name: profile?.display_name || 'User', appUrl }) as any,
                idempotencyKey: `welcome-${user.id}`
            }).then(res => {
                // Update job status to sent
                supabaseAdmin.from("onboarding_email_jobs")
                    .update({ status: 'sent', sent_at: new Date().toISOString(), resend_email_id: res.data?.id })
                    .eq('user_id', user.id)
                    .eq('step_key', 'welcome')
                    .then();
            }).catch(err => {
                console.error("Failed to send welcome email", err);
                supabaseAdmin.from("onboarding_email_jobs")
                    .update({ status: 'failed', last_error: err.message })
                    .eq('user_id', user.id)
                    .eq('step_key', 'welcome')
                    .then();
            });
        });
    });

    res.status(200).json({ success: true });
  } catch (error) {
    respondWithError(res, error);
  }
}
