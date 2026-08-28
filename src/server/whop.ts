import { Whop } from "@whop/sdk";
import type { BillingPlanKey } from "../lib/billingPlans.js";
import { billingPlans } from "../lib/billingPlans.js";
import { getRequiredEnv } from "./env.js";

function toWebhookKey(secret: string) {
  return Buffer.from(secret, "utf8").toString("base64");
}

let whopClient: Whop | null = null;

export function getWhopClient() {
  if (!whopClient) {
    whopClient = new Whop({
      apiKey: getRequiredEnv("WHOP_API_KEY"),
    });
  }

  return whopClient;
}

export function getWhopWebhookKey() {
  return toWebhookKey(getRequiredEnv("WHOP_WEBHOOK_SECRET"));
}

export function getWhopPlanId(planKey: BillingPlanKey) {
  const whopPlanIds: Partial<Record<BillingPlanKey, string>> = {
    creator: getRequiredEnv("WHOP_CREATOR_PLAN_ID"),
    creator_plus: getRequiredEnv("WHOP_CREATOR_PLUS_PLAN_ID"),
    ultra: getRequiredEnv("WHOP_ULTRA_PLAN_ID"),
    top_up: getRequiredEnv("WHOP_TOP_UP_PLAN_ID"),
  };
  const whopPlanId = whopPlanIds[planKey];

  if (!whopPlanId) {
    throw new Error(`Missing Whop plan mapping for ${billingPlans[planKey].name}. Set the matching WHOP_*_PLAN_ID variable.`);
  }

  return whopPlanId;
}
