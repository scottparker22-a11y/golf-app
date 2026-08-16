import Link from "next/link";
import PageNav from "@/components/PageNav";
import AdminSetupLink from "@/components/admin/AdminSetupLink";

// Icon-badge nav — replaces the old Skins/Nassau/Ryder Cup row in the
// PAR-ker branding mockup with the app's actual destinations. Emoji
// instead of an icon library since none is wired up yet, and these
// read fine at this size without one.
const NAV_ITEMS: { href: string; emoji: string; label: string; ring: string }[] = [
  { href: "/trip/demo/leaderboard", emoji: "🏆", label: "Live Leaderboard", ring: "border-turf" },
  { href: "/trip/demo/scorecard", emoji: "⛳", label: "Enter Score", ring: "border-sand" },
  { href: "/trip/demo/rounds", emoji: "🕘", label: "Round History", ring: "border-flag" },
];

// Landing page — in a real build this would list the user's trips
// from Supabase and let them create a new one. Kept minimal here
// since trip creation isn't wired up yet.
export default function Home() {
  return (
    <main className="min-h-screen max-w-[460px] mx-auto flex flex-col">
      <PageNav />
      {/* Cropped from the source mockup — badge + "Buddy Trip Golf"
          tagline only, border trimmed off the source art. Full-width,
          edge-to-edge, no frame — reads as the page's own header
          rather than a picture sitting on the page. The mockup's
          Skins/Nassau/Ryder Cup row and description below it are left
          out; those get replaced with real nav below instead. */}
      <img
        src="/parker-logo-badge.png"
        alt="PAR-ker Score Keeper — Buddy Trip Golf"
        className="w-full h-auto block"
      />
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 pb-8 pt-5 text-center">
        <p className="text-chalk-dim text-sm max-w-xs">
          Live golf scoring for your buddy trip — leaderboard, scorecard, and round history,
          updating in real time from whoever&apos;s keeping score.
        </p>

        <div className="flex items-start justify-center gap-5">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1.5 w-[84px]">
              <span
                className={`w-14 h-14 rounded-full border-2 ${item.ring} bg-surface flex items-center justify-center text-2xl`}
              >
                {item.emoji}
              </span>
              <span className="text-[11px] font-bold text-chalk leading-tight">{item.label}</span>
            </Link>
          ))}
        </div>

        <div className="w-full max-w-[160px] border-t border-[color:var(--border)] mt-2 pt-4">
          <AdminSetupLink tripId="demo" />
        </div>
      </div>
    </main>
  );
}
