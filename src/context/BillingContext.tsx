import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import WhopCheckoutModal from "../components/WhopCheckoutModal";
import type { BillingPlanKey } from "../lib/billingPlans";
import { apiFetch, ApiError } from "../lib/apiClient";
import type { BillingCheckoutSession } from "../server/types";
import { useAuth } from "./AuthContext";

export interface BillingSnapshot {
  planKey: BillingPlanKey;
  planName: string;
  creditsRemaining: number;
  includedMonthlyCredits: number;
  lowCredit: boolean;
  canGenerate: boolean;
  manageUrl: string | null;
  membershipStatus: string | null;
  renewalPeriodEnd: string | null;
}

interface BillingContextValue {
  billing: BillingSnapshot | null;
  loading: boolean;
  checkoutPending: BillingPlanKey | null;
  refreshBilling: () => Promise<BillingSnapshot | null>;
  setBilling: React.Dispatch<React.SetStateAction<BillingSnapshot | null>>;
  startCheckout: (planKey: BillingPlanKey) => Promise<void>;
}

const BillingContext = createContext<BillingContextValue | undefined>(undefined);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPending, setCheckoutPending] = useState<BillingPlanKey | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<BillingCheckoutSession | null>(null);
  const [refreshingAfterCheckout, setRefreshingAfterCheckout] = useState(false);

  const checkoutStatus = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("status")
    : null;

  const refreshBilling = useCallback(async () => {
    if (!user) {
      setBilling(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      const response = await apiFetch<{ billing: BillingSnapshot }>("/api/billing/me");
      setBilling(response.billing);
      return response.billing;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setBilling(null);
        return null;
      }
      console.error("Failed to load billing state", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshBilling();
  }, [user?.uid]);

  useEffect(() => {
    if (!user || checkoutStatus !== "success") {
      return;
    }

    void refreshBilling();
  }, [checkoutStatus, refreshBilling, user]);

  const startCheckout = async (planKey: BillingPlanKey) => {
    if (!user) {
      window.location.assign("/signup");
      return;
    }

    setCheckoutPending(planKey);

    try {
      const returnPath = `${window.location.pathname}${window.location.search}`;
      const response = await apiFetch<BillingCheckoutSession>("/api/billing/checkout", {
        method: "POST",
        body: { planKey, returnPath },
      });

      setActiveCheckout(response);
    } finally {
      setCheckoutPending(null);
    }
  };

  const closeCheckout = () => {
    setActiveCheckout(null);
  };

  const handleCheckoutComplete = async () => {
    setRefreshingAfterCheckout(true);

    try {
      closeCheckout();
      await refreshBilling();
      window.setTimeout(() => {
        void refreshBilling();
      }, 2500);
    } finally {
      setRefreshingAfterCheckout(false);
    }
  };

  const value = {
    billing,
    loading,
    checkoutPending,
    refreshBilling,
    setBilling,
    startCheckout,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
      {activeCheckout ? (
        <WhopCheckoutModal
          checkout={activeCheckout}
          isRefreshing={refreshingAfterCheckout}
          onClose={closeCheckout}
          onComplete={() => void handleCheckoutComplete()}
        />
      ) : null}
    </BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);

  if (!context) {
    throw new Error("useBilling must be used within a BillingProvider");
  }

  return context;
}
