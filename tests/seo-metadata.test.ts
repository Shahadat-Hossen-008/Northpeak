import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { absoluteSiteUrl, createPageMeta } from "../src/builder/layout/meta";

const routesDir = fileURLToPath(new URL("../src/routes/", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

type Meta = Record<string, string>;
async function headMeta(file: string): Promise<{ metas: Meta[]; hasHead: boolean }> {
  const mod = await import(file);
  const options = (mod.Route as { options?: { head?: () => { meta?: Meta[] } } } | undefined)
    ?.options;
  const head = options?.head?.();
  return { metas: head?.meta ?? [], hasHead: Boolean(options?.head) };
}

const routeFiles = walk(routesDir).filter((f) => /\.tsx$/.test(f));
const rel = (f: string) => relative(routesDir, f).replaceAll("\\", "/");
const isPrivate = (f: string) => rel(f).startsWith("_authenticated/");
const AUTH_FLOW = new Set(["login.tsx", "register.tsx", "reset-password.tsx", "welcome.tsx"]);
const PUBLIC = new Set(["index.tsx", "features.tsx", "roles.tsx", "get-started.tsx"]);
const robotsOf = (metas: Meta[]) => metas.find((m) => m.name === "robots")?.content ?? "";

test("SEO-01: the authenticated layout route marks every private route noindex, nofollow", async () => {
  const { metas } = await headMeta(join(routesDir, "_authenticated/route.tsx"));
  assert.match(robotsOf(metas), /noindex/);
  assert.match(robotsOf(metas), /nofollow/);
});

test("SEO-02: every private route file lives under the _authenticated layout and never opts into indexing", async () => {
  const privateFiles = routeFiles.filter(isPrivate);
  assert.ok(privateFiles.length >= 10, "expected the private route tree to be discovered");
  for (const file of privateFiles) {
    const { metas } = await headMeta(file);
    assert.doesNotMatch(
      robotsOf(metas),
      /^index|,\s*index/i,
      `${rel(file)} must not request indexing`,
    );
  }
  // No manager/developer workspace route may exist outside the guarded layout.
  const escaped = routeFiles.filter(
    (f) => /(^|\/)(manager|developer)\b/.test(rel(f)) && !isPrivate(f),
  );
  assert.deepEqual(escaped.map(rel), []);
});

test("SEO-03: sign-in, registration, reset and welcome pages are noindex", async () => {
  for (const file of routeFiles.filter((f) => AUTH_FLOW.has(rel(f)))) {
    const { metas } = await headMeta(file);
    assert.match(robotsOf(metas), /noindex/, rel(file));
  }
  assert.equal(routeFiles.filter((f) => AUTH_FLOW.has(rel(f))).length, AUTH_FLOW.size);
});

test("SEO-04: public marketing pages are indexable with unique titles and descriptions", async () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const files = routeFiles.filter((f) => PUBLIC.has(rel(f)));
  assert.equal(files.length, PUBLIC.size);
  for (const file of files) {
    const { metas } = await headMeta(file);
    const title = metas.find((m) => "title" in m)?.["title"] ?? "";
    const description = metas.find((m) => m["name"] === "description")?.["content"] ?? "";
    assert.ok(title.length > 5, `${rel(file)} needs a title`);
    assert.ok(description.length >= 40, `${rel(file)} needs a descriptive meta description`);
    assert.doesNotMatch(robotsOf(metas), /noindex/, `${rel(file)} must stay indexable`);
    assert.ok(
      (title.match(/Northpeak/g) ?? []).length <= 1 || title.startsWith("Northpeak"),
      `${rel(file)} repeats the brand in its title: ${title}`,
    );
    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!descriptions.has(description), `duplicate description on ${rel(file)}`);
    titles.add(title);
    descriptions.add(description);
  }
});

test("SEO-05: local HTTP configuration deliberately omits absolute URL tags", () => {
  const head = createPageMeta(
    "Features",
    "Feature details for Northpeak.",
    "/features",
    "http://localhost:8080",
  );
  assert.deepEqual(head.links, []);
  assert.equal(
    head.meta.some((m) => m["property"] === "og:url"),
    false,
  );
  assert.equal(
    head.meta.some((m) => m["property"] === "og:image"),
    false,
  );
  assert.equal(
    head.meta.some((m) => m["name"] === "twitter:image"),
    false,
  );
  assert.ok(head.meta.some((m) => m["name"] === "description"));
});

test("SEO-06: each configured public page gets one absolute canonical and social URL set", async () => {
  const expectedPaths: Record<string, string> = {
    "index.tsx": "/",
    "features.tsx": "/features",
    "roles.tsx": "/roles",
    "get-started.tsx": "/get-started",
  };
  for (const file of routeFiles.filter((f) => PUBLIC.has(rel(f)))) {
    const { metas } = await headMeta(file);
    const title = metas.find((m) => "title" in m)?.["title"] ?? "";
    const description = metas.find((m) => m["name"] === "description")?.["content"] ?? "";
    const head = createPageMeta(
      title,
      description,
      expectedPaths[rel(file)],
      "https://northpeak.test/",
    );
    const canonical = head.links.filter((link) => link.rel === "canonical");
    const og = head.meta.filter((item) => item["property"] === "og:url");
    const images = head.meta.filter((item) => item["property"] === "og:image");
    const twitterImages = head.meta.filter((item) => item["name"] === "twitter:image");
    assert.equal(canonical.length, 1, rel(file));
    assert.equal(canonical[0].href, `https://northpeak.test${expectedPaths[rel(file)]}`);
    assert.equal(og.length, 1, rel(file));
    assert.equal(og[0].content, canonical[0].href);
    assert.equal(images.length, 1, rel(file));
    assert.equal(images[0].content, "https://northpeak.test/northpeak-social.png");
    assert.equal(twitterImages.length, 1, rel(file));
    assert.equal(twitterImages[0].content, images[0].content);
    assert.ok(head.meta.some((item) => item["property"] === "og:title"));
    assert.ok(head.meta.some((item) => item["property"] === "og:description"));
    assert.ok(
      head.meta.some((item) => item["property"] === "og:type" && item["content"] === "website"),
    );
    assert.ok(head.meta.some((item) => item["name"] === "twitter:card"));
    assert.ok(!JSON.stringify(head).match(/localhost|http:\/\//i));
  }
});

test("SEO-07: invalid or missing origins never generate absolute metadata URLs", () => {
  for (const origin of [
    undefined,
    "",
    "http://northpeak.dev",
    "https://northpeak.dev/path",
    "https://user:pass@northpeak.dev",
  ]) {
    const head = createPageMeta("Home", "Northpeak projects and deadlines.", "/", origin);
    assert.equal(head.links.length, 0);
    assert.equal(
      head.meta.some((item) => item["property"] === "og:url"),
      false,
    );
    assert.equal(
      head.meta.some((item) => item["property"] === "og:image"),
      false,
    );
    assert.equal(
      head.meta.some((item) => item["name"] === "twitter:image"),
      false,
    );
  }
});

test("SEO-08: configured HTTPS origins produce absolute canonical and social image URLs", () => {
  const origin = "https://northpeak.test/";
  assert.equal(absoluteSiteUrl("/features", origin), "https://northpeak.test/features");
  assert.equal(
    absoluteSiteUrl("/northpeak-social.png", origin),
    "https://northpeak.test/northpeak-social.png",
  );
  assert.equal(absoluteSiteUrl("/features", "http://northpeak.test"), undefined);
});
