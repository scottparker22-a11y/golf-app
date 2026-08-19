"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Thin utility bar for Back / Forward / Home, shown at the top of
// every page. Exists because this app is meant to be added to a
// phone's home screen (PWA-style), where there's no browser chrome —
// no address bar, no back/forward buttons — so those controls have
// to live in the page itself or there's no way to navigate at all.
export default function PageNav() {
  const router = useRouter();

  const buttonClass =
    "flex-1 text-center text-[12.5px] font-semibold py-1.5 rounded-lg text-chalk-dim bg-surface border border-[color:var(--border)] active:bg-surface-raised";

  return (
    <div className="flex gap-1.5 px-5 pt-3">
      <Link href="/" className={buttonClass} aria-label="Go to home page">
        Home
      </Link>
      <button type="button" onClick={() => router.back()} className={buttonClass} aria-label="Go back">
        ← Back
      </button>
      <button type="button" onClick={() => router.forward()} className={buttonClass} aria-label="Go forward">
        Forward →
      </button>
    </div>
  );
}
