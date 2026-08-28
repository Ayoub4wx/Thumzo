import { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import type { BillingCheckoutSession } from "../server/types";

type WhopCheckoutModalProps = {
  checkout: BillingCheckoutSession;
  isRefreshing: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export default function WhopCheckoutModal({
  checkout,
  isRefreshing,
  onClose,
  onComplete,
}: WhopCheckoutModalProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const checkoutStatus = searchParams.get("status");
  const stateId = searchParams.get("state_id") || undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-background shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-muted"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Secure checkout</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Complete your purchase without leaving Thumora</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Payments are processed by Whop. Your credits will refresh automatically after the payment webhook lands.
          </p>
          {checkoutStatus === "error" ? (
            <p className="mt-3 text-sm font-medium text-destructive">
              Payment authorization was canceled or failed. You can try again below.
            </p>
          ) : null}
        </div>

        <div className="min-h-[560px] flex-1 overflow-y-auto bg-card/40 px-4 py-4 sm:px-6 sm:py-6">
          <WhopCheckoutEmbed
            sessionId={checkout.sessionId}
            returnUrl={checkout.returnUrl}
            skipRedirect
            stateId={stateId}
            theme="system"
            themeOptions={{ accentColor: "orange" }}
            onComplete={() => onComplete()}
            fallback={
              <div className="flex min-h-[480px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading checkout...
              </div>
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 text-sm text-muted-foreground">
          <span>{isRefreshing ? "Refreshing your billing state..." : "Card entry stays on this page."}</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-background px-4 font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
