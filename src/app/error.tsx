"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Veloce Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl text-red-400 mb-6 shadow-2xl">
        ⚠
      </div>
      <span className="text-xs uppercase tracking-widest text-red-400 font-semibold">System Exception</span>
      <h1 className="text-3xl font-light tracking-wide text-white mt-2 mb-3">Service Interruption</h1>
      <p className="text-xs text-gray-400 max-w-sm mb-8 font-light leading-relaxed">
        {error.message || "An unexpected error occurred while executing this operation. Our system engineers have been alerted."}
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors"
        >
          Retry Operation
        </button>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
