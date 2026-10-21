"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const Map = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full min-h-[340px] bg-[#0f0f11] animate-pulse flex items-center justify-center text-gray-500 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
        <span>Initializing Veloce Mobility Map...</span>
      </div>
    </div>
  )
});

export default function DashboardMapBanner() {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.6315,
    lng: 77.2167
  });

  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {
          // Fallback to Connaught Place default
        },
        { timeout: 5000 }
      );
    }
  }, []);

  return (
    <div className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-[#111] shadow-2xl">
      {/* Map Header Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-3">
        <div className="rounded-full bg-black/80 backdrop-blur border border-white/10 px-4 py-1.5 text-xs font-light text-white shadow-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Live Fleet Radar</span>
        </div>
        <div className="hidden sm:flex rounded-full bg-black/80 backdrop-blur border border-[#d4af37]/30 px-3 py-1.5 text-[11px] text-[#d4af37] shadow-lg">
          Connaught Place • Central Mobility Zone
        </div>
      </div>

      {/* Embedded Leaflet Map */}
      <div className="h-72 sm:h-80 w-full relative">
        <Map driverLocation={coords} />
      </div>

      {/* Quick Booking Floating Action Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-t from-black via-black/95 to-black/80 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold block">Instant Chauffeur Dispatch</span>
          <p className="text-sm font-light text-gray-200">Where would you like to travel today?</p>
        </div>
        <Link
          href="/dashboard/book"
          className="w-full sm:w-auto px-6 py-2.5 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b5952f] transition-all text-center shadow-[0_0_20px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2"
        >
          <span>Reserve a Ride</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
