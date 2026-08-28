import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import SiteFooter from "./SiteFooter";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.11)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.11)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_72%,transparent_100%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.032)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.032)_1px,transparent_1px)]" />

      <div className="relative z-10">
        <Navbar />
        <div>{children}</div>
        {!isAuthPage ? <SiteFooter /> : null}
      </div>
    </div>
  );
}
