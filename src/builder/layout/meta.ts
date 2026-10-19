// Keep this as a direct Vite env access so the configured value is included in
// both the client and server builds.
const siteUrl =
  typeof import.meta.env === "undefined" ? undefined : import.meta.env["VITE_SITE_URL"];
const socialImagePath = "/northpeak-social.png";

export function absoluteSiteUrl(path: string, baseUrl = siteUrl) {
  if (!baseUrl) return undefined;
  try {
    const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
    const url = new URL(normalizedBase);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return new URL(path, `${url.origin}/`).toString();
  } catch {
    return undefined;
  }
}

export function createPageMeta(
  title: string,
  description: string,
  path?: string,
  baseUrl = siteUrl,
) {
  const pageUrl = path ? absoluteSiteUrl(path, baseUrl) : undefined;
  const imageUrl = absoluteSiteUrl(socialImagePath, baseUrl);
  return {
    meta: [
      { title: `${title} — Northpeak` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Northpeak` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(pageUrl ? [{ property: "og:url", content: pageUrl }] : []),
      ...(imageUrl ? [{ property: "og:image", content: imageUrl }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${title} — Northpeak` },
      { name: "twitter:description", content: description },
      ...(imageUrl ? [{ name: "twitter:image", content: imageUrl }] : []),
    ],
    links: pageUrl ? [{ rel: "canonical", href: pageUrl }] : [],
  };
}

export function meta(title: string, description: string, path?: string) {
  return createPageMeta(title, description, path);
}
