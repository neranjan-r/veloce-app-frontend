"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";

interface DriverHistoryRide {
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
}

export default function DriverHistoryPage() {
  const { fetchApi } = useApi();
  const [rides, setRides] = useState<DriverHistoryRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedRide, setSelectedRide] = useState<DriverHistoryRide | null>(null);

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
      const message = err instanceof Error ? err.message : "Failed to load history";
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

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 bg-[#0a0a0a] min-h-screen text-white pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 mb-8 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light text-white">Chauffeur <span className="text-[#d4af37]">Log</span></h1>
          <p className="text-xs text-gray-400 mt-1">Completed journeys and revenue settlement records</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/driver/earnings" className="text-xs text-[#d4af37] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]">
            View Earnings
          </Link>
          <Link href="/driver" className="text-xs text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            &larr; Driver Console
          </Link>
        </div>
      </div>

      {/* Filter and pagination */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter ride status">
          {["ALL", "COMPLETED", "CANCELLED"].map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => { setStatusFilter(filter); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-wider font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] ${
                statusFilter === filter
                  ? "bg-[#d4af37] text-black"
                  : "bg-white/5 text-gray-400 border border-white/10 hover:border-[#d4af37]/40"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
            >
              &larr; Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="px-3 py-1 bg-white/5 border border-white/10 rounded disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-[#111]">
          <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-gray-400">Loading chauffeur records...</p>
        </div>
      ) : rides.length === 0 ? (
        <div className="py-20 text-center border border-white/5 rounded-2xl bg-[#111]">
          <p className="text-gray-400 text-sm">No trip records found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map(ride => {
            const farePaise = ride.fareFinalPaise || ride.fareEstimatePaise;
            const fareRupees = Math.round(farePaise / 100);
            const driverCut = Math.round((farePaise * 0.8) / 100);

            return (
              <div
                key={ride.id}
                className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-[#111] hover:border-[#d4af37]/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                    <span className="text-xs font-semibold text-white">Ride #{ride.id.slice(-6)}</span>
                    <span className="text-[10px] text-gray-500">{formatDate(ride.createdAt)}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                      ride.status === "COMPLETED" || ride.status === "PAID"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {ride.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">
                    {ride.pickupAddress} &rarr; {ride.dropAddress}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-gray-500 block">Your Revenue (80%)</span>
                    <span className="text-sm sm:text-base font-bold text-emerald-400">₹{driverCut}</span>
                    <span className="text-[10px] text-gray-500 block">Total: ₹{fareRupees}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRide(ride)}
                    className="px-3.5 sm:px-4 py-2 border border-white/10 hover:border-[#d4af37] text-[#d4af37] text-xs font-medium rounded-xl transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                  >
                    Trip Drawer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Driver Detail Drawer Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
          <div className="bg-[#111] border border-[#d4af37]/60 rounded-2xl max-w-lg w-full p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedRide(null)}
              aria-label="Close trip details"
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] rounded-lg"
            >
              ✕
            </button>

            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Chauffeur Itinerary</span>
              <h3 id="drawer-title" className="text-lg sm:text-xl font-light text-white mt-1">Trip Record #{selectedRide.id.slice(-8)}</h3>
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
                <div>
                  <span className="text-gray-400 block">Total Passenger Fare:</span>
                  <span className="text-sm font-semibold text-white">
                    ₹{Math.round((selectedRide.fareFinalPaise || selectedRide.fareEstimatePaise) / 100)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block">Your Net Earnings (80%):</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-400">
                    ₹{Math.round(((selectedRide.fareFinalPaise || selectedRide.fareEstimatePaise) * 0.8) / 100)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href={`http://localhost:4000/api/rides/${selectedRide.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 text-center bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                Download Receipt (PDF)
              </a>
              <button
                type="button"
                onClick={() => setSelectedRide(null)}
                className="px-5 py-3 border border-white/10 hover:border-white/30 text-white text-xs uppercase rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
