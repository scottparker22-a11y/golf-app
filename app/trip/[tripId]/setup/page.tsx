import SetupWizard from "@/components/setup/SetupWizard";

export default function SetupPage({ params }: { params: { tripId: string } }) {
  return <SetupWizard tripId={params.tripId} />;
}
