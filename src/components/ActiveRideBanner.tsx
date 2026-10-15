"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";

interface ActiveRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  fareEstimatePaise: number;
}

export default function ActiveRideBanner() {
  const { fetchApi } = useApi();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);

  useEffect(() => {
    fetchApi("/api/rides/active")
      .then((res) => {
        if (res.data) {
          setActiveRide(res.data);
        }
      })
      .catch(() => {});
  }, [fetchApi]);

  if (!activeRide) return null;

  return (
    <div className="mb-8 p-5 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-widest text-[#d4af37]">
            Active Journey • {activeRide.status}
          </span>
        </div>
        <p className="text-sm text-white font-light truncate max-w-lg">
          {activeRide.pickupAddress} <span className="text-gray-400">→</span> {activeRide.dropAddress}
        </p>
      </div>

      <Link
        href={`/dashboard/ride/${activeRide.id}`}
        className="px-5 py-2.5 bg-[#d4af37] text-black text-xs font-semibold rounded-lg hover:bg-[#b5952f] transition-all tracking-wider uppercase text-center shrink-0 shadow-md"
      >
        Track Live Journey →
      </Link>
    </div>
  );
}
