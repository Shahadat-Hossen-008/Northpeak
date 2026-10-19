import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ssrBuild = resolve(process.cwd(), ".output/server/_ssr/ssr.mjs");
const hasBuild = existsSync(ssrBuild);

function configuredHttpsOrigin() {
  const ssrDirectory = resolve(process.cwd(), ".output/server/_ssr");
  const metaBundle = readdirSync(ssrDirectory)
    .map((name) => readFileSync(resolve(ssrDirectory, name), "utf8"))
    .find((source) => source.includes('"VITE_SITE_URL"'));
  const configuredValue = metaBundle?.match(/"VITE_SITE_URL":\s*"([^"]*)"/)?.[1];
  if (!configuredValue) return undefined;
  try {
    const url = new URL(configuredValue);
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
    return url.origin;
  } catch {
    return undefined;
  }
}

test(
  "SEO-09: production server responses render route metadata without duplicates or private data",
  { skip: !hasBuild && "Run npm run build before checking rendered document HTML." },
  async () => {
    const { default: worker } = await import(pathToFileURL(ssrBuild).href);
    assert.equal(
      existsSync(resolve(process.cwd(), ".output/public/northpeak-social.png")),
      true,
      "the independently deployed client build must include the social image asset",
    );
    const routes = [
      ["/", "Deadline-aware project management — Northpeak"],
      ["/features", "Features & Deadline Engine — Northpeak"],
      ["/roles", "Roles & Workflows — Northpeak"],
      ["/get-started", "Choose your workspace — Northpeak"],
    ];

    for (const [path, title] of routes) {
      const request = new Request(`https://render-check.invalid${path}`);
      const response = await worker.fetch(request, {}, { waitUntil() {} });
      const html = await response.text();
      assert.equal(response.status, 200, path);
      const titleTag = html.match(/<title>(.*?)<\/title>/);
      assert.equal(titleTag?.[1].replaceAll("&amp;", "&"), title);
      assert.equal((html.match(/<title>/g) ?? []).length, 1, path);
      for (const property of ["og:title", "og:description", "og:type"]) {
        assert.equal(
          (html.match(new RegExp(`property="${property}"`, "g")) ?? []).length,
          1,
          `${path} ${property}`,
        );
      }
      for (const name of ["description", "twitter:card", "twitter:title", "twitter:description"]) {
        assert.equal(
          (html.match(new RegExp(`name="${name}"`, "g")) ?? []).length,
          1,
          `${path} ${name}`,
        );
      }

      const origin = configuredHttpsOrigin();
      const expectedPageUrl = origin ? new URL(path, `${origin}/`).toString() : undefined;
      const expectedImageUrl = origin ? `${origin}/northpeak-social.png` : undefined;
      const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map((match) => match[0]);
      const matches = (pattern: RegExp) => tags.filter((tag) => pattern.test(tag));
      const expectedUrlTags = [
        [matches(/rel="canonical"/), expectedPageUrl, "canonical", "href"],
        [matches(/property="og:url"/), expectedPageUrl, "og:url", "content"],
        [matches(/property="og:image"/), expectedImageUrl, "og:image", "content"],
        [matches(/name="twitter:image"/), expectedImageUrl, "twitter:image", "content"],
      ] as const;
      for (const [tagList, expectedUrl, label, attribute] of expectedUrlTags) {
        assert.equal(tagList.length, expectedUrl ? 1 : 0, `${path} ${label}`);
        if (expectedUrl) {
          assert.equal(tagList[0].match(new RegExp(`${attribute}="([^"]+)"`))?.[1], expectedUrl);
          assert.doesNotMatch(tagList[0], /localhost|http:\/\//i);
        }
      }
      assert.doesNotMatch(html, /example\.com|https?:\/\/[^\s"']+\.invalid/);
    }

    const privateResponse = await worker.fetch(
      new Request("https://render-check.invalid/manager/dashboard"),
      {},
      { waitUntil() {} },
    );
    const privateHtml = await privateResponse.text();
    assert.equal((privateHtml.match(/name="robots"/g) ?? []).length, 1);
    assert.match(privateHtml, /content="noindex, nofollow"/);
    assert.doesNotMatch(
      privateHtml,
      /Nadia Chowdhury|Sarah Khan|Rahim Ahmed|John Doe|Ayesha Siddiqua|password123|northpeak_token/,
    );
  },
);
