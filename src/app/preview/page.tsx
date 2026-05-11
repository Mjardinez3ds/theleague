import Link from "next/link";

export const dynamic = "force-static";

const PREVIEWS = [
  {
    href: "/",
    title: "Live (current)",
    sub: "Dark navy + gold · the live theme",
    swatch: ["#0a0e1a", "#ffc400", "#131826"],
  },
  {
    href: "/preview/sleeper",
    title: "Sleeper",
    sub: "Violet gradients · colored avatars",
    swatch: ["#0a0a0f", "#8b5cf6", "#ec4899"],
  },
  {
    href: "/preview/neon",
    title: "Neon / Sportsbook",
    sub: "Pure black · electric green · all caps",
    swatch: ["#000000", "#00ff88", "#00d9ff"],
  },
  {
    href: "/preview/minimal",
    title: "Minimal / Editorial",
    sub: "White · serif · generous whitespace",
    swatch: ["#fafaf7", "#1a1a1a", "#c8102e"],
  },
  {
    href: "/preview/retro",
    title: "Retro / Trading Card",
    sub: "Cream paper · navy · burnt orange",
    swatch: ["#f3e9d2", "#1a2b4a", "#c2410c"],
  },
];

export default function PreviewIndex() {
  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <header>
        <p className="text-[11px] font-bold tracking-widest text-accent">
          DESIGN PREVIEWS
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          Pick a vibe
        </h1>
        <p className="text-sm text-muted mt-1">
          Tap any to preview. The live site stays as it is until you say so.
        </p>
      </header>

      <ul className="space-y-3">
        {PREVIEWS.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="flex items-center gap-3 rounded-2xl border border-app bg-elev p-4 active:bg-elev-2"
            >
              <div className="flex gap-1">
                {p.swatch.map((c) => (
                  <span
                    key={c}
                    className="size-6 rounded-md border border-black/30"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">{p.title}</div>
                <div className="text-xs text-muted truncate">{p.sub}</div>
              </div>
              <span className="text-accent font-bold">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
