import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function Page() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Suspense fallback={<div>Loading...</div>}>
        <SignUp />
      </Suspense>
    </div>
  );
}

export const instant = false;
