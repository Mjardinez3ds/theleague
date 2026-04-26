export const dynamic = "force-static";

export default function AwardsPage() {
  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5">
        <p className="text-[11px] font-bold tracking-widest text-accent">
          COMING SOON
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">Season Awards</h1>
        <p className="text-sm text-muted">
          End-of-season trophies, roasts, and bragging rights.
        </p>
      </header>

      <div className="rounded-2xl border border-app bg-elev p-6 text-center">
        <div className="text-5xl mb-3">🏆</div>
        <p className="text-base font-semibold mb-1">Awards drop after Week 17.</p>
        <p className="text-sm text-muted">
          Manager of the Year. Luckbox of the Year. Toilet Bowl champion. Worst
          lineup setter. We&apos;re cooking.
        </p>
      </div>
    </div>
  );
}
