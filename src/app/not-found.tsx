"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-20 h-20 rounded-full bg-white/5 border border-[#d4af37]/30 flex items-center justify-center text-3xl text-[#d4af37] mb-6 shadow-2xl">
        ✦
      </div>
      <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">404 Exception</span>
      <h1 className="text-3xl font-light tracking-wide text-white mt-2 mb-3">Destination Not Found</h1>
      <p className="text-xs text-gray-400 max-w-sm mb-8 font-light leading-relaxed">
        The route, dispatch, or concierge resource you requested does not exist or has been relocated.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors"
        >
          Return to Dashboard
        </Link>
        <Link
          href="/"
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition-colors"
        >
          Veloce Homepage
        </Link>
      </div>
    </div>
  );
}
