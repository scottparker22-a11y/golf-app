import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-only Supabase client that reads the Supabase Auth session
// from cookies — for the couple of places that need to know "who is
// this" before the page even renders (e.g. the /setup route guard).
// No middleware.ts in this app (see lib/adminAuth.ts's comment on
// why), so there's no proactive token refresh on every navigation —
// a Server Component can read the current session but can't write a
// refreshed one back, since Next only allows setting cookies from a
// Server Action or Route Handler. That's an acceptable trade-off
// here: the client-side supabase-js instance (lib/supabase.ts)
// already auto-refreshes in the background for every page that
// actually uses it, so a stale Server Component read just means an
// occasional extra login prompt, never a silently-wrong permission
// decision (RLS + can_score()/is_admin() are the real enforcement,
// not this).
function getServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Server Components can't set cookies — no-op rather than
        // throw. Route Handlers that need to persist a refreshed
        // session should use this same helper but wire up real
        // set/remove via the response's cookies.
        set() {},
        remove() {},
      },
    }
  );
}

/** True if the current request's Supabase Auth session belongs to an active admin. Never throws. */
export async function isRealAdminSession(): Promise<boolean> {
  try {
    const supabase = getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return !!data && data.role === "admin" && data.active;
  } catch {
    return false;
  }
}
