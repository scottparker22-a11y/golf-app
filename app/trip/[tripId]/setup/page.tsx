import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminFlag } from "@/lib/adminAuth";
import { isRealAdminSession } from "@/lib/supabaseServer";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import SetupWizard from "@/components/setup/SetupWizard";

// Route guard — non-admins hitting /setup directly get bounced to the
// PIN screen. This is the "hide the UI" layer only; the real
// enforcement is every app/api/admin/* route independently re-checking
// the same cookie (or, increasingly, a real admin session — see
// lib/adminAuth.ts) before it writes anything.
//
// Mid-migration to real Supabase Auth: either the legacy shared PIN
// cookie OR a real logged-in admin session unlocks this page, same
// "either works" bridge as lib/useIsAdmin.ts.
export default async function SetupPage({ params }: { params: { tripId: string } }) {
  const isAdmin = getAdminFlag(cookies(), DEMO_TRIP_ID) || (await isRealAdminSession());
  if (!isAdmin) {
    redirect(`/trip/${params.tripId}/admin?next=/trip/${params.tripId}/setup`);
  }

  return <SetupWizard tripId={params.tripId} />;
}
