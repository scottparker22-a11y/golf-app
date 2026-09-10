import { Suspense } from "react";
import LoginScreen from "@/components/auth/LoginScreen";

export default function LoginPage() {
  // useSearchParams (for ?next=) requires a Suspense boundary — same
  // pattern as app/trip/[tripId]/admin/page.tsx's PIN screen.
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
