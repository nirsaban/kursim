import { LandingPage } from "@/components/landing/LandingPage";

// The pricing section reads super-admin-configured packages from the DB —
// render per request, or edits would be baked in at build time.
export const dynamic = "force-dynamic";

export default function Home() {
  return <LandingPage />;
}
