import type { Membership, Payment } from "@whop/sdk/resources/shared";
import type { UnwrapWebhookEvent } from "@whop/sdk/resources/webhooks";
import { billingPlans, getPlanDefinition, type BillingPlanKey } from "../lib/billingPlans.js";
import { resolveAppUrl } from "./env.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import type { BillingCheckoutSession, BillingSnapshot } from "./types.js";
import { getWhopClient, getWhopPlanId } from "./whop.js";

type BillingMembershipRow = {
  membership_id: string;
  user_id: string;
  plan_key: BillingPlanKey | null;
  status: string | null;
  manage_url: string | null;
  renewal_period_end: string | null;
  updated_at: string | null;
};

type CreditLedgerRow = {
  entry_direction: "credit" | "debit" | null;
  amount: number | null;
  created_at?: string | null;
  idempotency_key?: string | null;
};

const activeMembershipStatuses = new Set(["active", "trialing"]);
const lowCreditThreshold = 2;

function isActiveMembershipStatus(status: string | null | undefined) {
  return status ? activeMembershipStatuses.has(status) : false;
}

function normalizeRelativeWhopUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://whop.com${value}`;
}

function normalizeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/settings/billing";
  }

  return value;
}

function coercePlanKey(value: unknown): BillingPlanKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "hobby":
    case "creator":
    case "creator_plus":
    case "ultra":
    case "top_up":
      return normalized;
    case "creator+":
      return "creator_plus";
    default:
      return null;
  }
}

function planKeyFromPlanId(planId: string | null | undefined) {
  if (!planId) {
    return null;
  }

  if (process.env.WHOP_CREATOR_PLAN_ID === planId) {
    return "creator" as const;
  }

  if (process.env.WHOP_CREATOR_PLUS_PLAN_ID === planId) {
    return "creator_plus" as const;
  }

  if (process.env.WHOP_ULTRA_PLAN_ID === planId) {
    return "ultra" as const;
  }

  if (process.env.WHOP_TOP_UP_PLAN_ID === planId) {
    return "top_up" as const;
  }

  return null;
}

function currentMembershipForRows(rows: BillingMembershipRow[]) {
  const activeMembership =
    rows.find((row) => isActiveMembershipStatus(row.status)) ||
    rows.find((row) => row.status === "past_due") ||
    rows[0] ||
    null;

  return activeMembership;
}

function metadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  return metadata?.[key];
}

function isMissingRpcError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      (error as { code: string }).code === "PGRST202",
  );
}

function isMissingBillingSchemaError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      ["PGRST202", "PGRST205", "42P01"].includes((error as { code: string }).code),
  );
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string" &&
      (error as { code: string }).code === "23505",
  );
}

function fallbackBillingSnapshot() {
  const hobbyPlan = getPlanDefinition("hobby");

  return {
    planKey: hobbyPlan.key,
    planName: "Billing unavailable",
    creditsRemaining: 0,
    includedMonthlyCredits: 0,
    lowCredit: true,
    canGenerate: false,
    manageUrl: null,
    membershipStatus: null,
    renewalPeriodEnd: null,
  } satisfies BillingSnapshot;
}

async function readCreditLedgerBalance(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.from("credit_ledger").select("entry_direction,amount").eq("user_id", userId);

  if (error) {
    throw error;
  }

  return ((data as CreditLedgerRow[] | null) || []).reduce((total, entry) => {
    const amount = Number(entry.amount || 0);
    return total + (entry.entry_direction === "debit" ? -amount : amount);
  }, 0);
}

async function readCreditBalance(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("get_credit_balance", {
    target_user: userId,
  });

  if (error && !isMissingRpcError(error)) {
    throw error;
  }

  if (error) {
    return readCreditLedgerBalance(userId);
  }

  return Number(data || 0);
}

async function ensureHobbyCreditsIfDue(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("grant_hobby_credits_if_due", {
    target_user: userId,
    grant_amount: billingPlans.hobby.monthlyCredits,
  });

  if (error && !isMissingRpcError(error)) {
    throw error;
  }

  if (!error) {
    return Boolean(data);
  }

  const { data: activeMembership, error: membershipError } = await supabaseAdmin
    .from("billing_memberships")
    .select("membership_id")
    .eq("user_id", userId)
    .in("status", Array.from(activeMembershipStatuses))
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (activeMembership?.membership_id) {
    return false;
  }

  const { data: latestGrant, error: latestGrantError } = await supabaseAdmin
    .from("credit_ledger")
    .select("created_at")
    .eq("user_id", userId)
    .eq("entry_direction", "credit")
    .eq("source_type", "free_monthly")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestGrantError) {
    throw latestGrantError;
  }

  if (latestGrant?.created_at) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (new Date(latestGrant.created_at).getTime() > thirtyDaysAgo) {
      return false;
    }
  }

  const grantKey = `free:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const { error: insertError } = await supabaseAdmin.from("credit_ledger").upsert(
    {
      user_id: userId,
      entry_direction: "credit",
      amount: billingPlans.hobby.monthlyCredits,
      source_type: "free_monthly",
      description: "Hobby monthly credit refill",
      idempotency_key: grantKey,
      metadata: {
        grant_window: "rolling_30_day",
      },
    },
    { onConflict: "idempotency_key" },
  );

  if (insertError) {
    throw insertError;
  }

  return true;
}

export async function getBillingSnapshotForUser(userId: string): Promise<BillingSnapshot> {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    await ensureHobbyCreditsIfDue(userId);

    const [{ data: memberships, error: membershipError }, creditsRemaining] = await Promise.all([
      supabaseAdmin
        .from("billing_memberships")
        .select("membership_id,user_id,plan_key,status,manage_url,renewal_period_end,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      readCreditBalance(userId),
    ]);

    if (membershipError) {
      throw membershipError;
    }

    const currentMembership = currentMembershipForRows((memberships as BillingMembershipRow[] | null) || []);
    const currentPlanKey =
      (currentMembership?.plan_key && currentMembership.plan_key !== "top_up"
        ? currentMembership.plan_key
        : "hobby") as BillingPlanKey;
    const currentPlan = getPlanDefinition(currentPlanKey);

    return {
      planKey: currentPlan.key,
      planName: currentPlan.name,
      creditsRemaining,
      includedMonthlyCredits: currentPlan.monthlyCredits,
      lowCredit: creditsRemaining <= lowCreditThreshold,
      canGenerate: creditsRemaining > 0,
      manageUrl: currentMembership?.manage_url || null,
      membershipStatus: currentMembership?.status || null,
      renewalPeriodEnd: currentMembership?.renewal_period_end || null,
    };
  } catch (error) {
    if (!isMissingBillingSchemaError(error)) {
      throw error;
    }

    return fallbackBillingSnapshot();
  }
}

export async function getUsageHistory(userId: string, period: string = "cycle") {
  const supabase = getSupabaseAdmin();

  let days = 30;
  if (period === "1d") days = 1;
  else if (period === "7d") days = 7;
  else if (period === "30d" || period === "cycle") days = 30;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("credit_ledger")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_direction", "debit")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch usage history:", error);
    throw new Error("Failed to fetch usage history");
  }

  const history = (data || []).map((entry: any) => {
    let modelLabel = entry.metadata?.model || "gemini-3-pro-image-preview";
    let costPerGeneration = 1.20;

    // Tiered pricing logic
    if (modelLabel.includes("gemini-3-pro")) {
      modelLabel = "Gemini 3 Pro";
      costPerGeneration = 1.20;
    } else if (modelLabel.includes("gemini-3.1-flash")) {
      modelLabel = "Gemini 3.1 Flash";
      costPerGeneration = 0.80;
    } else if (modelLabel.includes("gemini-2.5-flash")) {
      modelLabel = "Gemini 2.5 Flash";
      costPerGeneration = 0.40;
    } else if (modelLabel.includes("gpt-image-2")) {
      modelLabel = "GPT Image 2";
      costPerGeneration = 1.20;
    } else if (modelLabel.includes("gpt-image-1.5")) {
      modelLabel = "GPT Image 1.5";
      costPerGeneration = 0.80;
    } else if (modelLabel.includes("gpt-image-1-mini")) {
      modelLabel = "GPT Image 1 Mini";
      costPerGeneration = 0.40;
    } else if (modelLabel.includes("gpt-image-1")) {
      modelLabel = "GPT Image 1";
      costPerGeneration = 0.80;
    }

    const calculatedCost = (entry.amount || 1) * costPerGeneration;

    return {
      id: entry.id,
      date: entry.created_at,
      type: entry.source_type === "generation_debit" ? "Generation" : "Debit",
      model: modelLabel,
      cost: `$${calculatedCost.toFixed(2)}`,
    };
  });

  // Daily aggregation for the requested period
  const dailyUsage: Record<string, number> = {};
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    dailyUsage[d.toISOString().split('T')[0]] = 0;
  }

  (data || []).forEach((entry: any) => {
    const day = new Date(entry.created_at).toISOString().split('T')[0];
    if (dailyUsage[day] !== undefined) {
      const model = entry.metadata?.model || "";
      let multiplier = 1.20;
      if (
        model.includes("gemini-3.1-flash") ||
        model.includes("gpt-image-1.5") ||
        (model.includes("gpt-image-1") && !model.includes("gpt-image-1-mini"))
      ) {
        multiplier = 0.80;
      } else if (model.includes("gemini-2.5-flash") || model.includes("gpt-image-1-mini")) {
        multiplier = 0.40;
      }
      
      dailyUsage[day] += (entry.amount || 1) * multiplier;
    }
  });

  const dailyStats = Object.entries(dailyUsage)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { history, dailyStats };
}

export async function consumeOneCredit(userId: string, requestId: string, metadata: Record<string, any> = {}) {
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data, error } = await supabaseAdmin.rpc("consume_credit", {
      target_user: userId,
      idempotency_key_input: `generation:${requestId}`,
      debit_description: "AI thumbnail generation",
    });

    if (error && !isMissingRpcError(error)) {
      throw error;
    }

    const idempotencyKey = `generation:${requestId}`;

    if (error) {
      const { data: existingEntry, error: existingEntryError } = await supabaseAdmin
        .from("credit_ledger")
        .select("idempotency_key")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .limit(1)
        .maybeSingle();

      if (existingEntryError) {
        throw existingEntryError;
      }

      if (existingEntry?.idempotency_key) {
        return true;
      }

      const balance = await readCreditLedgerBalance(userId);
      if (balance < 1) {
        return false;
      }

      const { error: insertError } = await supabaseAdmin.from("credit_ledger").insert({
        user_id: userId,
        entry_direction: "debit",
        amount: 1,
        source_type: "generation_debit",
        description: "AI thumbnail generation",
        idempotency_key: idempotencyKey,
        metadata: {
          request_id: requestId,
          ...metadata,
        },
      });

      if (insertError && !isDuplicateKeyError(insertError)) {
        throw insertError;
      }

      return true;
    }
    
    // If RPC succeeded, update the metadata (as RPC doesn't accept it)
    if (data) {
        await supabaseAdmin
          .from("credit_ledger")
          .update({ metadata: { request_id: requestId, ...metadata } })
          .eq("user_id", userId)
          .eq("idempotency_key", idempotencyKey);
    }

    return Boolean(data);
  } catch (error) {
    if (!isMissingBillingSchemaError(error)) {
      throw error;
    }

    return false;
  }
}

export async function refundConsumedCredit(userId: string, requestId: string, message: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("credit_ledger").upsert(
    {
      user_id: userId,
      entry_direction: "credit",
      amount: 1,
      source_type: "generation_refund",
      description: `Refunded AI credit: ${message}`.slice(0, 200),
      idempotency_key: `generation-refund:${requestId}`,
      metadata: {
        request_id: requestId,
      },
    },
    { onConflict: "idempotency_key" },
  );

  if (error && !isMissingBillingSchemaError(error)) {
    throw error;
  }
}

export async function createCheckoutForUser(params: {
  userId: string;
  email: string | null;
  planKey: BillingPlanKey;
  requestHeaders?: Record<string, unknown>;
  returnPath?: string | null;
}): Promise<BillingCheckoutSession> {
  if (params.planKey === "hobby") {
    throw new Error("The free plan does not require checkout.");
  }

  const plan = getPlanDefinition(params.planKey);
  const planId = getWhopPlanId(params.planKey);
  const appUrl = resolveAppUrl(params.requestHeaders);
  const returnPath = normalizeReturnPath(params.returnPath);
  const returnUrl = new URL(returnPath, `${appUrl}/`).toString();
  const whopClient = getWhopClient();

  const checkoutConfiguration = await whopClient.checkoutConfigurations.create({
    plan_id: planId,
    mode: "payment",
    metadata: {
      supabase_user_id: params.userId,
      plan_key: plan.key,
      kind: plan.kind,
      credit_amount: plan.monthlyCredits,
      user_email: params.email,
    },
    redirect_url: returnUrl,
    source_url: `${appUrl}/pricing`,
  });

  return {
    checkoutUrl: normalizeRelativeWhopUrl(checkoutConfiguration.purchase_url),
    planId: checkoutConfiguration.plan?.id || planId,
    returnUrl,
    sessionId: checkoutConfiguration.id,
  };
}

async function markWebhookProcessed(event: UnwrapWebhookEvent) {
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("processed_webhooks").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      payload: event,
    },
    { onConflict: "event_id" },
  );

  if (error) {
    throw error;
  }
}

async function webhookAlreadyProcessed(eventId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("processed_webhooks")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.event_id);
}

async function upsertMembershipFromWebhook(membership: Membership, fallbackEventType?: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const metadata = membership.metadata || {};
  const userId = typeof metadata.supabase_user_id === "string" ? metadata.supabase_user_id : null;

  if (!userId) {
    return;
  }

  const planKey =
    coercePlanKey(metadata.plan_key) ||
    planKeyFromPlanId(membership.plan?.id) ||
    null;

  const { error } = await supabaseAdmin.from("billing_memberships").upsert(
    {
      membership_id: membership.id,
      user_id: userId,
      whop_user_id: membership.user?.id || null,
      product_id: membership.product?.id || null,
      plan_id: membership.plan?.id || null,
      plan_key: planKey,
      status: membership.status || fallbackEventType || null,
      manage_url: membership.manage_url || null,
      currency: membership.currency || null,
      renewal_period_start: membership.renewal_period_start || null,
      renewal_period_end: membership.renewal_period_end || null,
      cancel_at_period_end: membership.cancel_at_period_end,
      metadata,
      updated_at: membership.updated_at || new Date().toISOString(),
    },
    { onConflict: "membership_id" },
  );

  if (error) {
    throw error;
  }
}

async function grantCreditsFromPayment(payment: Payment) {
  const supabaseAdmin = getSupabaseAdmin();
  const metadata = payment.metadata || {};
  const userId = typeof metadata.supabase_user_id === "string" ? metadata.supabase_user_id : null;

  if (!userId) {
    return;
  }

  const planKey =
    coercePlanKey(metadata.plan_key) ||
    planKeyFromPlanId(payment.plan?.id) ||
    "creator";
  const plan = getPlanDefinition(planKey);
  const creditAmount = Number(metadata.credit_amount || plan.monthlyCredits || 0);

  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    return;
  }

  const sourceType = metadata.kind === "top_up" || plan.key === "top_up" ? "top_up" : "payment";
  const membershipId = payment.membership?.id || null;
  const { error } = await supabaseAdmin.from("credit_ledger").upsert(
    {
      user_id: userId,
      entry_direction: "credit",
      amount: creditAmount,
      source_type: sourceType,
      description: `${plan.name} credit grant`,
      external_reference: payment.id,
      membership_id: membershipId,
      idempotency_key: `whop-payment:${payment.id}`,
      metadata: {
        plan_key: plan.key,
        whop_payment_id: payment.id,
        whop_plan_id: payment.plan?.id || null,
        whop_membership_id: membershipId,
      },
    },
    { onConflict: "idempotency_key" },
  );

  if (error) {
    throw error;
  }
}

export async function handleWhopWebhookEvent(event: UnwrapWebhookEvent) {
  const supabaseAdmin = getSupabaseAdmin();
  if (await webhookAlreadyProcessed(event.id)) {
    return;
  }

  switch (event.type) {
    case "payment.succeeded":
      await grantCreditsFromPayment(event.data);
      if (event.data.membership?.id) {
        const { data } = await supabaseAdmin
          .from("billing_memberships")
          .select("membership_id")
          .eq("membership_id", event.data.membership.id)
          .maybeSingle();

        if (!data && event.data.membership.id && event.data.metadata) {
          await upsertMembershipFromWebhook(
            {
              id: event.data.membership.id,
              cancel_at_period_end: false,
              cancel_option: null,
              canceled_at: null,
              cancellation_reason: null,
              company: event.data.company || { id: "", route: "", title: "" },
              created_at: event.data.created_at,
              currency: event.data.currency || null,
              custom_field_responses: [],
              joined_at: null,
              license_key: null,
              manage_url: null,
              member: event.data.member || null,
              metadata: event.data.metadata || {},
              payment_collection_paused: false,
              plan: event.data.plan || { id: "" },
              product: event.data.product || { id: "", route: "", title: "" },
              promo_code: null,
              renewal_period_end: null,
              renewal_period_start: null,
              status: "active",
              updated_at: event.data.paid_at || event.data.created_at,
              user: null,
            },
            "active",
          );
        }
      }
      break;
    case "membership.activated":
    case "membership.deactivated":
    case "membership.cancel_at_period_end_changed":
      await upsertMembershipFromWebhook(event.data, event.type);
      break;
    default:
      break;
  }

  await markWebhookProcessed(event);
}

export async function cancelAllUserMemberships(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data: memberships, error } = await supabase
    .from("billing_memberships")
    .select("membership_id")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"]);

  if (error || !memberships) {
    console.error("Failed to fetch user memberships for cancellation:", error);
    return;
  }

  if (memberships.length === 0) {
    return;
  }

  let whopClient: ReturnType<typeof getWhopClient>;
  try {
    whopClient = getWhopClient();
  } catch (error) {
    console.error(`Whop is not configured; skipping membership cancellation for user ${userId}:`, error);
    return;
  }

  for (const membership of memberships) {
    try {
      await whopClient.memberships.cancel(String(membership.membership_id));
      console.log(`Canceled Whop membership ${membership.membership_id} for user ${userId}`);
    } catch (cancelError) {
      console.error(`Failed to cancel membership ${membership.membership_id}:`, cancelError);
    }
  }
}
