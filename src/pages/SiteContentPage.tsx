import { useLocation } from "react-router-dom";
import { useDocumentMetadata } from "../lib/useDocumentMetadata";
import NotFoundPage from "./NotFoundPage";

type LegalSection = {
  heading: string;
  paragraphs: string[];
};

type LegalPage = {
  eyebrow: string;
  heading: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

const legalPages: Record<string, LegalPage> = {
  "/terms-of-service": {
    eyebrow: "Legal",
    heading: "Terms of Service",
    title: "Terms of Service | Thumora AI",
    description: "These terms govern access to the Thumora AI thumbnail studio, billing, and AI generation features.",
    sections: [
      {
        heading: "Using the studio",
        paragraphs: [
          "Thumora AI is a thumbnail creation and editing product. You may use the studio only for lawful work and only if you have the rights needed for every image, prompt, and asset you upload or generate.",
          "You are responsible for reviewing all generated outputs before publishing them. AI results can contain mistakes, unexpected artifacts, or similarities to existing content.",
        ],
      },
      {
        heading: "Accounts and credits",
        paragraphs: [
          "Access to paid plans, top-ups, and billing-managed credits requires an account. Free Hobby credits, paid subscription credits, and top-up credits are tracked inside the app and may change if the product offering changes.",
          "A successful paid checkout may create or renew a subscription through Whop. Credits are granted after successful payment events and are enforced in the app before AI generation runs.",
        ],
      },
      {
        heading: "Payments and cancellations",
        paragraphs: [
          "Paid subscriptions and one-time top-up purchases are processed by Whop. Your use of Whop checkout and subscription management is also subject to Whop's own terms and policies.",
          "Unless required by law, completed payments are non-refundable. Canceling a subscription stops future renewals but does not automatically reverse credits already granted to your account.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "You may not use Thumora AI to create unlawful, deceptive, harassing, or rights-infringing content. That includes non-consensual likeness use, fraudulent impersonation, or content designed to mislead people about real events or people.",
          "We may suspend access if we believe an account is abusing the product, violating these terms, or creating material legal or operational risk.",
        ],
      },
    ],
  },
  "/privacy-policy": {
    eyebrow: "Legal",
    heading: "Privacy Policy",
    title: "Privacy Policy | Thumora AI",
    description: "This policy explains how Thumora AI handles account data, uploaded assets, billing state, and AI requests.",
    sections: [
      {
        heading: "What we store",
        paragraphs: [
          "Thumora AI stores account information provided through Supabase authentication, your uploaded assets, generated thumbnails, and billing-related records needed to enforce credits and subscriptions.",
          "We also store operational metadata such as plan state, credit ledger entries, webhook processing records, and generation history needed to keep the product working reliably.",
        ],
      },
      {
        heading: "Third-party services",
        paragraphs: [
          "Authentication, database storage, and file storage are provided through Supabase. Image generation requests are processed through OpenAI on the server side, while prompt analysis and ideation helpers may use Google Gemini. Payments and subscription webhooks are processed through Whop.",
          "Each provider may process limited technical data needed to complete authentication, storage, billing, or AI inference. Their services are governed by their own privacy practices.",
        ],
      },
      {
        heading: "How data is used",
        paragraphs: [
          "We use your data to operate the studio, secure accounts, process billing, enforce credits, store assets, and return generated outputs. We may also use service logs and product analytics to diagnose failures and improve reliability.",
          "We do not expose your private assets or account billing details publicly through the product without your action.",
        ],
      },
      {
        heading: "Data controls",
        paragraphs: [
          "You can stop using the service at any time. Account and subscription management actions available inside the app or inside the Whop manage flow control future billing behavior.",
          "If you need account support or data handling help, use the support channel associated with your account or billing receipt so the request can be matched to the correct workspace.",
        ],
      },
    ],
  },
};

export default function SiteContentPage() {
  const location = useLocation();
  const page = legalPages[location.pathname];

  useDocumentMetadata({
    title: page?.title || "Thumora AI",
    description: page?.description,
    canonicalPath: location.pathname,
  });

  if (!page) {
    return <NotFoundPage />;
  }

  return (
    <div className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-border bg-card/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.06)] sm:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{page.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{page.heading}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{page.description}</p>
          <p className="mt-3 text-sm text-muted-foreground">Last updated April 11, 2026.</p>
        </div>

        <div className="mt-10 space-y-8">
          {page.sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
