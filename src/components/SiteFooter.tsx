import { Instagram, Linkedin, Music2, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import BrandLogo from "./BrandLogo";

const productLinks = [
  { label: "My Projects", href: "/projects" },
  { label: "Tutorials", href: "/tutorials" },
  { label: "Templates", href: "/templates" },
  { label: "Assets", href: "/assets" },
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/changelog" },
  { label: "Billing", href: "/settings/billing" },
];

const legalLinks: Array<{ label: string; href?: string; onClick?: () => void }> = [
  { label: "Terms", href: "/terms-of-service" },
  { label: "Privacy", href: "/privacy-policy" },
  { 
    label: "Cookie Preferences", 
    onClick: () => window.dispatchEvent(new Event("open-cookie-consent")) 
  },
];

const resourceLinks = [
  { label: "YouTube Thumbnail Maker", href: "/youtube-thumbnail-maker" },
  { label: "AI Thumbnail Remaker", href: "/ai-thumbnail-remaker" },
  { label: "Thumbnail Ideas", href: "/thumbnail-ideas-for-youtube" },
  { label: "YouTube URL Import", href: "/thumbnail-maker-from-youtube-url" },
];

const socialLinks: Array<{
  label: string;
  href: string;
  icon: "x" | "youtube" | "instagram" | "tiktok" | "linkedin";
}> = [
  { label: "X", href: "https://x.com/thumoraai", icon: "x" },
  { label: "YouTube", href: "https://www.youtube.com/@thumorai", icon: "youtube" },
  { label: "Instagram", href: "https://www.instagram.com/thumoraai/", icon: "instagram" },
  { label: "TikTok", href: "https://www.tiktok.com/@thumoraai", icon: "tiktok" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/thumora-ai/", icon: "linkedin" },
];

function SocialIcon({ icon }: { icon: "x" | "youtube" | "instagram" | "tiktok" | "linkedin" }) {
  if (icon === "youtube") {
    return <Youtube className="h-4 w-4" />;
  }

  if (icon === "instagram") {
    return <Instagram className="h-4 w-4" />;
  }

  if (icon === "tiktok") {
    return <Music2 className="h-4 w-4" />;
  }

  if (icon === "linkedin") {
    return <Linkedin className="h-4 w-4" />;
  }

  return <span className="text-sm font-medium leading-none">X</span>;
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href?: string; onClick?: () => void }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        {links.map((link) => {
          if (link.onClick) {
            return (
              <button
                key={link.label}
                onClick={link.onClick}
                className="text-left hover:text-foreground transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            );
          }
          if (link.href && link.href.startsWith("http")) {
            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            );
          }
          return (
            <Link key={link.href} to={link.href || "#"} className="hover:text-foreground transition-colors">
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/30 backdrop-blur-sm">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_repeat(4,1fr)] lg:px-8">
        <div className="space-y-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <BrandLogo size="md" />
          </Link>
          <p className="max-w-sm text-sm text-muted-foreground">
            AI thumbnail editing for creators who want faster iteration, sharper concepts, and export-ready results.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {socialLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                aria-label={link.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <SocialIcon icon={link.icon} />
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="Product" links={productLinks} />
        <FooterColumn title="Resources" links={resourceLinks} />
        <FooterColumn 
          title="Company" 
          links={[
            { label: "About Us", href: "/about" },
            { label: "Contact & Support", href: "/contact" },
            { label: "FAQ", href: "/faq" },
          ]} 
        />
        <FooterColumn title="Legal" links={legalLinks} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>(c) 2026 Thumora AI</span>
          <span>Built for creator-first thumbnail workflows.</span>
        </div>
      </div>
    </footer>
  );
}
