"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleModel: string;
  plateNumber: string;
  avgRating: number;
}

interface RideHistoryItem {
  id: string;
  status: string;
  vehicleType: string;
  pickupAddress: string;
  dropAddress: string;
  distanceMeters: number;
  durationSeconds: number;
  fareEstimatePaise: number;
  fareFinalPaise?: number | null;
  createdAt: string;
  driver?: DriverInfo | null;
}

export default function HistoryPage() {
  const { fetchApi } = useApi();
  const [rides, setRides] = useState<RideHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const res = await fetchApi("/api/rides/history");
        if (res.data) {
          setRides(res.data);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load journey history";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [fetchApi]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Completed</span>;
      case "IN_PROGRESS":
        return <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">In Progress</span>;
      case "ARRIVED":
        return <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Chauffeur Arrived</span>;
      case "ACCEPTED":
        return <span className="text-xs bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Chauffeur Assigned</span>;
      case "REQUESTED":
        return <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Requested</span>;
      case "CANCELLED":
        return <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Cancelled</span>;
      default:
        return <span className="text-xs bg-white/10 text-gray-300 px-2.5 py-1 rounded tracking-wider uppercase font-medium">{status}</span>;
    }
  };

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-wide text-white uppercase">
            Journey <span className="premium-text-gradient font-medium">History</span>
          </h1>
          <p className="text-gray-400 mt-2 font-light tracking-widest text-xs uppercase">
            A comprehensive record of your private travels
          </p>
        </div>
        <Link
          href="/dashboard/book"
          className="self-start sm:self-auto px-6 py-3 bg-[#d4af37] text-black text-xs font-semibold uppercase tracking-wider rounded-sm hover:bg-[#b5952f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)]"
        >
          Reserve New Journey
        </Link>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 premium-glass border border-white/10 rounded-sm">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 font-light tracking-wider text-sm uppercase">Loading itineraries...</p>
        </div>
      ) : rides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 premium-glass border border-white/10 rounded-sm text-center px-4">
          <span className="text-5xl mb-4 opacity-40">✧</span>
          <h3 className="text-xl font-light text-white uppercase tracking-wider mb-2">No Past Journeys</h3>
          <p className="text-gray-400 font-light text-sm max-w-md mb-8">
            Your travel log is empty. Experience unparalleled luxury with your first reservation today.
          </p>
          <Link
            href="/dashboard/book"
            className="px-8 py-3.5 border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition-all rounded-sm text-xs font-semibold uppercase tracking-widest"
          >
            Book Your First Journey
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {rides.map((ride) => {
            const farePaise = ride.fareFinalPaise || ride.fareEstimatePaise;
            const fareRupees = Math.round(farePaise / 100);
            const distanceKm = (ride.distanceMeters / 1000).toFixed(1);
            const durationMins = Math.round(ride.durationSeconds / 60);

            return (
              <div
                key={ride.id}
                className="premium-glass border border-white/10 hover:border-[#d4af37]/50 transition-all duration-300 rounded-sm p-6 sm:p-8"
              >
                {/* Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[#d4af37] text-lg font-bold">✧</span>
                    <div>
                      <span className="text-sm font-medium text-white tracking-wide uppercase">
                        {ride.vehicleType}
                      </span>
                      <span className="text-xs text-gray-500 ml-3">
                        {formatDate(ride.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(ride.status)}
                    <span className="text-xl font-semibold text-[#d4af37] tracking-tight">
                      ₹{fareRupees}
                    </span>
                  </div>
                </div>

                {/* Route Info */}
                <div className="grid md:grid-cols-3 gap-6 items-center">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex items-start gap-4">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Pickup</p>
                        <p className="text-sm text-white font-light mt-0.5">{ride.pickupAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <span className="w-2.5 h-2.5 bg-[#d4af37] mt-1.5 flex-shrink-0"></span>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">Destination</p>
                        <p className="text-sm text-white font-light mt-0.5">{ride.dropAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Trip Stats & Link */}
                  <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 space-y-4">
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>Distance: <span className="text-white font-medium">{distanceKm} km</span></p>
                      <p>Duration: <span className="text-white font-medium">{durationMins} mins</span></p>
                      {ride.driver && (
                        <p>Chauffeur: <span className="text-[#d4af37] font-medium">{ride.driver.name} ({ride.driver.vehicleModel})</span></p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/ride/${ride.id}`}
                      className="inline-flex items-center justify-center text-xs text-[#d4af37] hover:text-white uppercase tracking-widest border border-white/10 hover:border-[#d4af37] py-2 px-4 transition-colors rounded-sm"
                    >
                      View Trip Details &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
