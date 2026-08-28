import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Folder,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  PenTool,
  Scissors,
  Search,
  Sparkles,
  TrendingUp,
  Wand2,
  Youtube,
} from "lucide-react";
import { apiFetch } from "../../lib/apiClient";
import { cn } from "../../lib/utils";
import { CREATOR_TOOLS, type CreatorToolId } from "../../lib/studioMetadata";
import type { YoutubeIntegrationStatus, YoutubeVideosResponse } from "../../server/types";

const TOOL_ICONS: Record<CreatorToolId, typeof Sparkles> = {
  "remove-bg": Scissors,
  upscale: Maximize2,
  polish: Wand2,
};

export default function BulkEditsDashboard() {
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<YoutubeIntegrationStatus | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [videosResponse, setVideosResponse] = useState<YoutubeVideosResponse | null>(null);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadIntegration() {
      try {
        setIntegrationLoading(true);
        setIntegrationError(null);
        const response = await apiFetch<YoutubeIntegrationStatus>("/api/integrations/youtube");

        if (!cancelled) {
          setIntegration(response);
        }
      } catch (error) {
        console.error("Failed to load YouTube integration", error);
        if (!cancelled) {
          setIntegrationError(error instanceof Error ? error.message : "Failed to load YouTube integration.");
        }
      } finally {
        if (!cancelled) {
          setIntegrationLoading(false);
        }
      }
    }

    void loadIntegration();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!integration?.connected || !integration.selectedChannel) {
      setVideosResponse(null);
      return;
    }

    let cancelled = false;

    async function loadVideos() {
      try {
        setVideosLoading(true);
        setVideosError(null);
        const params = new URLSearchParams();
        if (appliedQuery) {
          params.set("query", appliedQuery);
        }
        if (pageToken) {
          params.set("pageToken", pageToken);
        }
        params.set("limit", "12");

        const response = await apiFetch<YoutubeVideosResponse>(`/api/integrations/youtube/videos?${params.toString()}`);

        if (!cancelled) {
          setVideosResponse(response);
        }
      } catch (error) {
        console.error("Failed to load YouTube videos", error);
        if (!cancelled) {
          setVideosError(error instanceof Error ? error.message : "Failed to load YouTube videos.");
        }
      } finally {
        if (!cancelled) {
          setVideosLoading(false);
        }
      }
    }

    void loadVideos();

    return () => {
      cancelled = true;
    };
  }, [appliedQuery, integration?.connected, integration?.selectedChannel, pageToken]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPageToken(null);
    setAppliedQuery(searchQuery.trim());
  };

  const handleImport = (video: NonNullable<YoutubeVideosResponse["videos"]>[number]) => {
    const params = new URLSearchParams({
      templateUrl: video.thumbnailUrl,
      sourceType: "youtube",
      sourceId: video.id,
      sourceTitle: video.title,
    });

    navigate(`/studio?${params.toString()}`);
  };

  const selectedChannel = integration?.selectedChannel;
  const hasConnectedYoutube = Boolean(integration?.connected && selectedChannel);
  const youtubeSectionTitle = useMemo(() => {
    if (hasConnectedYoutube) {
      return "YouTube imports";
    }

    return "Optional YouTube utility";
  }, [hasConnectedYoutube]);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 overflow-x-hidden px-3 py-4 pb-8 sm:px-6 sm:py-6 lg:px-8" dir="ltr">
      <section className="rounded-[30px] bg-card/55 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_70px_rgba(0,0,0,0.2)] sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Tools</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Creator tools workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Background cutouts, polish, upscales, Growth Lab experiments, and YouTube thumbnail imports.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[560px]">
            <div className="grid grid-cols-3 gap-2">
              <HeaderStat label="Studio tools" value={String(CREATOR_TOOLS.length)} />
              <HeaderStat label="Growth" value="Lab" />
              <HeaderStat label="Imports" value={hasConnectedYoutube ? "Ready" : "Setup"} />
            </div>
            <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-background/45 p-1">
              <button className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-foreground shadow-[0_12px_28px_rgba(255,77,28,0.24)]">
                <PenTool className="h-4 w-4" /> Tools
              </button>
              <Link
                to="/tools/growth"
                className="flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              >
                <TrendingUp className="h-4 w-4" /> Growth Lab
              </Link>
              <Link
                to="/projects"
                className="flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              >
                <Folder className="h-4 w-4" /> My Projects
              </Link>
              <Link
                to="/templates"
                className="flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              >
                <ImageIcon className="h-4 w-4" /> Templates
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link
          to="/tools/growth"
          className="group rounded-[26px] bg-card/45 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_58px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
        >
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black tracking-[-0.02em] text-foreground">Growth Lab</h2>
              <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                Paid plans
              </span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              CTR estimates, title packs, A/B variants, face optimization, and viral pattern presets.
            </p>
            <div className="pt-2 text-sm font-black text-accent">Open Growth Lab</div>
          </div>
        </Link>

        {CREATOR_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => navigate(`/studio?tool=${tool.id}`)}
              className="group rounded-[26px] bg-card/45 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_22px_58px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-black tracking-[-0.02em] text-foreground">{tool.title}</h2>
                  {tool.id === "upscale" ? (
                    <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                      Paid plans
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{tool.description}</p>
                <div className="pt-2 text-sm font-black text-accent">{tool.actionLabel}</div>
              </div>
            </button>
          );
        })}
      </section>

      <section id="youtube-import" className="scroll-mt-24 overflow-hidden rounded-[30px] bg-card/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_70px_rgba(0,0,0,0.18)]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{youtubeSectionTitle}</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">YouTube imports</h2>
            </div>

            {selectedChannel ? (
              <div className="rounded-2xl bg-background/60 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Selected Channel</p>
                <p className="mt-1 text-sm font-black text-foreground">{selectedChannel.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedChannel.handle || selectedChannel.id}</p>
              </div>
            ) : null}
          </div>
        </div>

        {integrationLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading YouTube utility...
          </div>
        ) : integrationError ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-bold text-foreground">Could not load YouTube utility</p>
            <p className="mt-2 text-sm text-muted-foreground">{integrationError}</p>
          </div>
        ) : integration && !integration.configured ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-bold text-foreground">YouTube OAuth is not configured</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Add `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET`, and a valid `APP_URL` on the server before enabling imports.
            </p>
            <Link
              to="/settings/integrations"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-background/75 px-5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              Open Integrations
            </Link>
          </div>
        ) : integration && !integration.connected ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <Youtube className="h-8 w-8" />
            </div>
            <p className="text-lg font-bold text-foreground">Connect YouTube when you need imports</p>
            <Link
              to="/settings/integrations"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.28)] transition-transform hover:-translate-y-0.5"
            >
              Connect a Channel
            </Link>
          </div>
        ) : integration && !integration.selectedChannel ? (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-bold text-foreground">Choose a channel in Settings</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your Google account is connected, but imports need one selected channel before this library can populate.
            </p>
            <Link
              to="/settings/integrations"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.28)] transition-transform hover:-translate-y-0.5"
            >
              Select Channel
            </Link>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search titles on the selected channel"
                  className="w-full rounded-2xl bg-background/70 py-3 pl-10 pr-4 text-sm text-foreground outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors placeholder:text-muted-foreground focus:bg-muted/45"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-black text-accent-foreground shadow-[0_14px_34px_rgba(255,77,28,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Search
              </button>
            </form>

            {videosError ? <p className="mb-4 text-sm text-red-500">{videosError}</p> : null}

            {videosLoading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading imported thumbnails...
              </div>
            ) : videosResponse && videosResponse.videos.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {videosResponse.videos.map((video) => (
                    <article key={video.id} className="overflow-hidden rounded-[24px] bg-background/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="aspect-video overflow-hidden bg-black">
                        <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      </div>
                      <div className="space-y-4 p-4">
                        <div>
                          <h3 className="line-clamp-2 text-base font-bold text-foreground">{video.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {new Date(video.publishedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleImport(video)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl bg-accent px-4 text-sm font-black text-accent-foreground transition-transform hover:-translate-y-0.5"
                        >
                          Open in editor
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPageToken(videosResponse.prevPageToken)}
                    disabled={!videosResponse.prevPageToken}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-bold transition-colors",
                      videosResponse.prevPageToken
                        ? "bg-background/70 text-foreground hover:bg-muted"
                        : "cursor-not-allowed bg-background/35 text-muted-foreground opacity-60"
                    )}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageToken(videosResponse.nextPageToken)}
                    disabled={!videosResponse.nextPageToken}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-bold transition-colors",
                      videosResponse.nextPageToken
                        ? "bg-background/70 text-foreground hover:bg-muted"
                        : "cursor-not-allowed bg-background/35 text-muted-foreground opacity-60"
                    )}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-background/45 px-6 py-20 text-center">
                <p className="text-lg font-bold text-foreground">No imported thumbnails found</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-background/45 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-black text-foreground">{value}</p>
    </div>
  );
}
