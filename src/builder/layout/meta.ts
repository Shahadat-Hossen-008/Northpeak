export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Northpeak` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Northpeak` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
