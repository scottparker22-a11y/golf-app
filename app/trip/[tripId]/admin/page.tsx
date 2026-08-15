import { Suspense } from "react";
import AdminPinScreen from "@/components/admin/AdminPinScreen";

export default function AdminPage({ params }: { params: { tripId: string } }) {
  return (
    // useSearchParams (for ?next=) requires a Suspense boundary.
    <Suspense fallback={null}>
      <AdminPinScreen tripId={params.tripId} />
    </Suspense>
  );
}
