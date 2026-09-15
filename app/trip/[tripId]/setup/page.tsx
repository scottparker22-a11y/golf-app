import { redirect } from "next/navigation";
import { isRealAdminSession } from "@/lib/supabaseServer";
import SetupWizard from "@/components/setup/SetupWizard";

// Route guard — non-admins hitting /setup directly get bounced to
// login. This is the "hide the UI" layer only; the real enforcement
// is every app/api/admin/* route independently re-checking the same
// real admin session before it writes anything (see lib/adminAuth.ts).
export default async function SetupPage({ params }: { params: { tripId: string } }) {
  const isAdmin = await isRealAdminSession();
  if (!isAdmin) {
    redirect(`/login?next=/trip/${params.tripId}/setup`);
  }

  return <SetupWizard tripId={params.tripId} />;
}
