import { Suspense } from "react";
import { CheckPage } from "@/components/CheckPage";

export default function Home() {
  return (
    <Suspense>
      <CheckPage />
    </Suspense>
  );
}
