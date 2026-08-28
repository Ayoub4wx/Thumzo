import { useEffect } from "react";
import { buildAbsoluteUrl, DEFAULT_OG_IMAGE, DEFAULT_ROBOTS, SITE_NAME } from "./siteMetadata";

interface DocumentMetadata {
  title: string;
  description?: string;
  canonicalPath?: string;
  robots?: string;
  ogType?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function getOrCreateMetaDescription() {
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }

  return meta;
}

function getOrCreateCanonicalLink() {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  return canonical;
}

function getOrCreateMetaTag(attribute: "name" | "property", key: string) {
  let meta = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }

  return meta;
}

function getOrCreateStructuredDataScript() {
  let script = document.getElementById("page-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.id = "page-structured-data";
    script.setAttribute("type", "application/ld+json");
    document.head.appendChild(script);
  }

  return script;
}

export function useDocumentMetadata({
  title,
  description,
  canonicalPath,
  robots = DEFAULT_ROBOTS,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  structuredData,
}: DocumentMetadata) {
  useEffect(() => {
    document.title = title;
    const resolvedDescription = description ?? "";
    const resolvedCanonical = canonicalPath ? buildAbsoluteUrl(canonicalPath) : buildAbsoluteUrl(window.location.pathname);

    getOrCreateMetaDescription().setAttribute("content", resolvedDescription);
    getOrCreateMetaTag("name", "title").setAttribute("content", title);
    getOrCreateMetaTag("name", "robots").setAttribute("content", robots);
    getOrCreateMetaTag("name", "googlebot").setAttribute("content", robots);

    getOrCreateCanonicalLink().setAttribute("href", resolvedCanonical);

    getOrCreateMetaTag("property", "og:type").setAttribute("content", ogType);
    getOrCreateMetaTag("property", "og:url").setAttribute("content", resolvedCanonical);
    getOrCreateMetaTag("property", "og:site_name").setAttribute("content", SITE_NAME);
    getOrCreateMetaTag("property", "og:title").setAttribute("content", title);
    getOrCreateMetaTag("property", "og:description").setAttribute("content", resolvedDescription);
    getOrCreateMetaTag("property", "og:image").setAttribute("content", ogImage);

    getOrCreateMetaTag("property", "twitter:card").setAttribute("content", "summary_large_image");
    getOrCreateMetaTag("property", "twitter:url").setAttribute("content", resolvedCanonical);
    getOrCreateMetaTag("property", "twitter:title").setAttribute("content", title);
    getOrCreateMetaTag("property", "twitter:description").setAttribute("content", resolvedDescription);
    getOrCreateMetaTag("property", "twitter:image").setAttribute("content", ogImage);

    const structuredDataScript = document.getElementById("page-structured-data");
    if (structuredData) {
      getOrCreateStructuredDataScript().textContent = JSON.stringify(structuredData);
    } else if (structuredDataScript) {
      structuredDataScript.remove();
    }
  }, [canonicalPath, description, ogImage, ogType, robots, structuredData, title]);
}
