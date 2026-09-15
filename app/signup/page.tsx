import { Suspense } from "react";
import SignupScreen from "@/components/auth/SignupScreen";

export default function SignupPage() {
  // useSearchParams (for ?next=) requires a Suspense boundary — same
  // pattern as app/login/page.tsx.
  return (
    <Suspense fallback={null}>
      <SignupScreen />
    </Suspense>
  );
}
