"use client";

// Site-wide login wall — nothing renders for an unauthenticated
// visitor except the login/signup screens. Wraps every page from
// app/layout.tsx, so no individual page needs its own check for this.
//
// This is the UI half only. The real enforcement is the "must be
// authenticated" RLS read policies (see
// supabase/add-auth-phase3-self-signup.sql) — without a session, the
// Supabase client's own reads return nothing regardless of what this
// component does, same "don't rely only on hiding the UI" principle
// as every write permission in this app.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!loading && !session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, session, isPublic, pathname, router]);

  // Avoid flashing real content (or a login form on top of it) before
  // the session check resolves, or during the redirect above.
  if (loading || (!session && !isPublic)) {
    return <div className="px-5 pt-8 text-sm text-chalk-dim">Loading…</div>;
  }

  return <>{children}</>;
}
