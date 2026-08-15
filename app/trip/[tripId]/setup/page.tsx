import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminFlag } from "@/lib/adminAuth";
import { DEMO_TRIP_ID } from "@/lib/rounds";
import SetupWizard from "@/components/setup/SetupWizard";

// Route guard — non-admins hitting /setup directly get bounced to the
// PIN screen. This is the "hide the UI" layer only; the real
// enforcement is every app/api/admin/* route independently re-checking
// the same cookie before it writes anything (see lib/adminAuth.ts).
export default function SetupPage({ params }: { params: { tripId: string } }) {
  const isAdmin = getAdminFlag(cookies(), DEMO_TRIP_ID);
  if (!isAdmin) {
    redirect(`/trip/${params.tripId}/admin?next=/trip/${params.tripId}/setup`);
  }

  return <SetupWizard tripId={params.tripId} />;
}
