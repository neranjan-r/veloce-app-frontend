"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedRide, setSelectedRide] = useState<RideHistoryItem | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("limit", "10");
      if (statusFilter !== "ALL") {
        query.set("status", statusFilter);
      }

      const res = await fetchApi(`/api/rides/history?${query.toString()}`);
      if (res.data) {
        if (Array.isArray(res.data)) {
          setRides(res.data);
          setTotalPages(1);
        } else if (res.data.rides) {
          setRides(res.data.rides);
          if (res.data.pagination) {
            setTotalPages(res.data.pagination.totalPages || 1);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load journey history";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchApi, page, statusFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
      case "PAID":
      case "SUCCEEDED":
        return <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Completed</span>;
      case "IN_PROGRESS":
        return <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">In Progress</span>;
      case "ARRIVED":
        return <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Arrived</span>;
      case "ACCEPTED":
        return <span className="text-xs bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 px-2.5 py-1 rounded tracking-wider uppercase font-medium">Assigned</span>;
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
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-6 gap-4">
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

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {["ALL", "COMPLETED", "IN_PROGRESS", "CANCELLED"].map(filter => (
            <button
              key={filter}
              onClick={() => { setStatusFilter(filter); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider transition-all font-medium ${
                statusFilter === filter
                  ? "bg-[#d4af37] text-black"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:border-[#d4af37]/40"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-30 hover:border-white/20"
            >
              &larr; Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-30 hover:border-white/20"
            >
              Next &rarr;
            </button>
          </div>
        )}
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
          <h3 className="text-xl font-light text-white uppercase tracking-wider mb-2">No Journeys Found</h3>
          <p className="text-gray-400 font-light text-sm max-w-md mb-8">
            {statusFilter === "ALL" ? "Your travel log is empty." : `No journeys matching status "${statusFilter}".`}
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

                  {/* Trip Stats & Actions */}
                  <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 space-y-3">
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>Distance: <span className="text-white font-medium">{distanceKm} km</span></p>
                      <p>Duration: <span className="text-white font-medium">{durationMins} mins</span></p>
                      {ride.driver && (
                        <p>Chauffeur: <span className="text-[#d4af37] font-medium">{ride.driver.name}</span></p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setSelectedRide(ride)}
                        className="flex-1 text-center text-xs text-[#d4af37] hover:text-white uppercase tracking-wider border border-white/10 hover:border-[#d4af37] py-2 px-3 transition-colors rounded-sm"
                      >
                        Trip Drawer
                      </button>
                      <Link
                        href={`/dashboard/ride/${ride.id}`}
                        className="flex-1 text-center text-xs text-white hover:text-[#d4af37] uppercase tracking-wider border border-white/10 hover:border-white/30 py-2 px-3 transition-colors rounded-sm"
                      >
                        Live View &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-[#d4af37]/60 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedRide(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Itinerary Details</span>
              <h3 className="text-xl font-light text-white mt-1">Journey #{selectedRide.id.slice(-8)}</h3>
              <p className="text-xs text-gray-500">{formatDate(selectedRide.createdAt)}</p>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-black/50 border border-white/5 text-xs">
              <div>
                <span className="text-gray-500 block uppercase tracking-wider">Pickup</span>
                <span className="text-white font-medium">{selectedRide.pickupAddress}</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase tracking-wider">Dropoff</span>
                <span className="text-white font-medium">{selectedRide.dropAddress}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider">Distance</span>
                  <span className="text-white font-medium">{(selectedRide.distanceMeters / 1000).toFixed(1)} km</span>
                </div>
                <div>
                  <span className="text-gray-500 block uppercase tracking-wider">Duration</span>
                  <span className="text-white font-medium">{Math.round(selectedRide.durationSeconds / 60)} mins</span>
                </div>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-gray-400">Total Fare:</span>
                <span className="text-base font-bold text-[#d4af37]">
                  ₹{Math.round((selectedRide.fareFinalPaise || selectedRide.fareEstimatePaise) / 100)}
                </span>
              </div>
            </div>

            {selectedRide.driver && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-xs space-y-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Assigned Chauffeur</span>
                <p className="text-white font-medium">{selectedRide.driver.name} ({selectedRide.driver.vehicleModel || "Mercedes-Benz E-Class"})</p>
                <p className="text-gray-400 font-mono">{selectedRide.driver.plateNumber || "DL 01 AB 1234"}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <a
                href={`http://localhost:4000/api/rides/${selectedRide.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 text-center bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors"
              >
                Download Receipt (PDF)
              </a>
              <button
                onClick={() => setSelectedRide(null)}
                className="px-5 py-3 border border-white/10 hover:border-white/30 text-white text-xs uppercase rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
