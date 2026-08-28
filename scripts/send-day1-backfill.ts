import { createHash } from "node:crypto";
import { GettingStartedEmail } from "../src/emails/GettingStartedEmail.js";
import { serverEnv } from "../src/server/env.js";
import { sendEmail } from "../src/server/mailer.js";
import { getSupabaseAdmin } from "../src/server/supabaseAdmin.js";

type AuthUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

function resolvePublicAppUrl() {
  const configuredUrl = serverEnv.authRedirectBaseUrl || serverEnv.appUrl || "https://www.thumoraai.com";

  if (/^https?:\/\/(localhost|127\.0\.0\.1|::1)(:\d+)?$/i.test(configuredUrl)) {
    return "https://www.thumoraai.com";
  }

  return configuredUrl.replace(/\/$/, "");
}

async function listAllUsers() {
  const supabaseAdmin = getSupabaseAdmin();
  const users: AuthUser[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const batch = (data.users || []) as AuthUser[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildIdempotencyKey(email: string) {
  const digest = createHash("sha256").update(`day1-backfill:${normalizeEmail(email)}`).digest("hex").slice(0, 24);
  return `backfill-day1-${digest}`;
}

async function main() {
  if (!serverEnv.resendApiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  const users = await listAllUsers();
  const appUrl = resolvePublicAppUrl();
  const uniqueConfirmedUsers = new Map<string, AuthUser>();

  for (const user of users) {
    if (!user.email || !user.email_confirmed_at) {
      continue;
    }

    uniqueConfirmedUsers.set(normalizeEmail(user.email), user);
  }

  const recipients = Array.from(uniqueConfirmedUsers.values()).sort((a, b) =>
    normalizeEmail(a.email || "").localeCompare(normalizeEmail(b.email || ""))
  );

  const summary = {
    totalUsers: users.length,
    confirmedUsers: recipients.length,
    sent: 0,
    failed: 0,
    failures: [] as Array<{ email: string; error: string }>,
  };

  for (const user of recipients) {
    const email = normalizeEmail(user.email || "");

    try {
      await sendEmail({
        to: email,
        subject: "Getting started tips",
        react: GettingStartedEmail({ appUrl, unsubscribeUrl: null }) as any,
        idempotencyKey: buildIdempotencyKey(email),
      });
      summary.sent += 1;
      console.log(`sent ${email}`);
    } catch (error) {
      summary.failed += 1;
      summary.failures.push({
        email,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`failed ${email}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
