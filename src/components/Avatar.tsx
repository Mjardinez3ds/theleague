/**
 * Manager avatar — deterministic colored circle with initials.
 *
 * Color is derived from the slug so every manager gets a stable, distinct
 * color that follows them across every page (standings, H2H, profile, etc).
 */

// 12 distinct, dark-theme-friendly colors. Saturated enough to read on bg-elev,
// muted enough not to fight the accent color.
const PALETTE = [
  ["bg-red-500/30",     "text-red-200"],
  ["bg-orange-500/30",  "text-orange-200"],
  ["bg-amber-500/30",   "text-amber-200"],
  ["bg-yellow-500/30",  "text-yellow-200"],
  ["bg-lime-500/30",    "text-lime-200"],
  ["bg-emerald-500/30", "text-emerald-200"],
  ["bg-teal-500/30",    "text-teal-200"],
  ["bg-cyan-500/30",    "text-cyan-200"],
  ["bg-sky-500/30",     "text-sky-200"],
  ["bg-indigo-500/30",  "text-indigo-200"],
  ["bg-violet-500/30",  "text-violet-200"],
  ["bg-fuchsia-500/30", "text-fuchsia-200"],
  ["bg-pink-500/30",    "text-pink-200"],
  ["bg-rose-500/30",    "text-rose-200"],
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h << 5) - h + slug.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-2xl",
};

export default function Avatar({
  name,
  slug,
  size = "sm",
  className = "",
}: {
  name: string;
  slug: string;
  size?: AvatarSize;
  className?: string;
}) {
  const [bg, fg] = PALETTE[hashSlug(slug) % PALETTE.length];
  return (
    <span
      className={`shrink-0 inline-flex items-center justify-center rounded-full font-bold ${bg} ${fg} ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
