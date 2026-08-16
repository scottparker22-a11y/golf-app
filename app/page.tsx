import Image from "next/image";
import Link from "next/link";
import PageNav from "@/components/PageNav";
import AdminSetupLink from "@/components/admin/AdminSetupLink";

// Icon-badge nav — replaces the mockup's Skins/Nassau/Ryder Cup row
// with the app's actual destinations. Emoji instead of an icon
// library since none is wired up yet, and these read fine at this size.
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
    // One continuous background for the whole page — colors sampled
    // directly from the logo mockup's own backdrop (#1D371D fading to
    // #011C11) rather than guessed/approximated. Earlier attempts put
    // a plain gradient behind just the hero image and left the rest
    // of the page on the app's default background, which still read
    // as a "box" wherever the two met. A gradient wash at the very
    // top fades to transparent, so the flat #011C11 base underneath
    // is what carries all the way to the bottom — no second seam.
    <main className="relative min-h-screen max-w-[460px] mx-auto flex flex-col bg-[#011C11] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-[#1D371D] to-transparent pointer-events-none" />
      <div className="relative flex flex-col flex-1">
        <PageNav />

        <div className="flex flex-col items-center px-8 pt-6 pb-2">
          <Image
            src="/parker-logo-badge.png"
            alt="PAR-ker Score Keeper"
            width={853}
            height={800}
            priority
            className="w-full max-w-[380px] h-auto object-contain"
          />
          {/* Real text, not baked into the image — the source mockup's
              script tagline had a descender ("y" in Buddy) that kept
              landing right on the crop boundary no matter where it was
              cut. This can't get clipped. */}
          <div className="flex items-center gap-3 -mt-1 w-full max-w-[280px]">
            <span className="flex-1 h-px bg-turf/40" />
            <span className="font-script text-turf text-2xl leading-none pb-1">Buddy Trip Golf</span>
            <span className="flex-1 h-px bg-turf/40" />
          </div>
        </div>

        <section className="flex-1 flex flex-col px-6 pt-8 pb-10 text-center">
          <p className="text-base leading-7 text-chalk-dim max-w-[320px] mx-auto">
            Live golf scoring for your buddy trip — leaderboard, scorecard, skins, and Ryder
            Cup, updating in real time from whoever&apos;s keeping score.
          </p>

          <div className="mt-11 grid grid-cols-3 gap-3">
            {NAV_ITEMS.map(item => (
              <HomeAction key={item.href} {...item} />
            ))}
          </div>

          <div className="mx-auto mt-14 max-w-[200px] w-full border-t border-white/10 pt-8">
            <AdminSetupLink tripId="demo" />
          </div>
        </section>
      </div>
    </main>
  );
}

function HomeAction({ href, emoji, label, ring }: { href: string; emoji: string; label: string; ring: string }) {
  return (
    <Link href={href} className="group flex flex-col items-center text-center">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-[3px] ${ring} bg-surface text-4xl shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:bg-surface-raised group-active:scale-95`}
      >
        {emoji}
      </div>
      <span className="mt-3 text-[13px] font-semibold leading-tight text-chalk max-w-[80px]">{label}</span>
    </Link>
  );
}
