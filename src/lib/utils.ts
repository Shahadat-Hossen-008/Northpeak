import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function projectSlug(project: { id: string; title: string }): string {
  const slug = slugify(project.title);
  return slug || project.id;
}

export function findProjectByIdOrSlug<T extends { id: string; title: string }>(
  projects: T[],
  idOrSlug: string | undefined | null,
): T | undefined {
  if (!idOrSlug) return undefined;
  const target = idOrSlug.trim().toLowerCase();

  // 1. Direct ID match
  const byId = projects.find((p) => p.id === idOrSlug);
  if (byId) return byId;

  // 2. Exact slug match
  const slugMatches = projects.filter((p) => slugify(p.title) === target);
  if (slugMatches.length === 1) return slugMatches[0];

  // 3. Case-insensitive title match
  const titleMatches = projects.filter((p) => p.title.toLowerCase() === target);
  return titleMatches.length === 1 ? titleMatches[0] : undefined;
}
