"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";

const STEP_ORDER = ["REQUESTED", "ACCEPTED", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

const STEP_LABELS: Record<string, string> = {
  REQUESTED: "Finding Driver",
  ACCEPTED: "Driver Assigned",
  ARRIVED: "Driver Arrived",
  IN_PROGRESS: "Trip in Progress",
  COMPLETED: "Trip Completed",
  CANCELLED: "Trip Cancelled"
};

export default function RidePage() {
  const { id } = useParams();
  const router = useRouter();
  const { fetchApi } = useApi();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let s: Socket | null = null;

    const init = async () => {
      // 1. Fetch initial ride state
      try {
        const res = await fetchApi(`/api/rides/${id}`);
        setRide(res.data);
        if (res.data.driver) {
          setDriver(res.data.driver);
        }
      } catch (e) {
        console.error("Error fetching ride:", e);
      }

      // 2. Connect socket for real-time lifecycle updates
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      s = io(apiUrl, {
        query: {
          userId: user?.id || "rider_guest",
          token: token || undefined
        }
      });

      s.on("connect", () => {
        console.log(`[Rider Socket] Connected. Joining ride:${id}`);
        s?.emit("ride:join", id);
      });

      s.on("ride:accepted", (data) => {
        console.log("[Rider Socket] Received ride:accepted:", data);
        if (data.ride) setRide(data.ride);
        if (data.driver) setDriver(data.driver);
      });

      s.on("ride:status", (data) => {
        console.log("[Rider Socket] Received ride:status:", data);
        if (data.ride) setRide(data.ride);
        if (data.driver) setDriver(data.driver);
      });

      s.on("ride:cancelled", (data) => {
        console.log("[Rider Socket] Received ride:cancelled:", data);
        if (data.ride) setRide(data.ride);
      });
    };

    init();

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [id, fetchApi, getToken, user]);

  const handleCancelRide = async () => {
    if (!confirm("Are you sure you want to cancel this ride?")) return;
    setCancelling(true);
    try {
      const res = await fetchApi(`/api/rides/${id}/cancel`, { method: "POST" });
      setRide(res.data);
    } catch (e) {
      console.error("Error cancelling ride:", e);
      alert("Failed to cancel ride.");
    } finally {
      setCancelling(false);
    }
  };

  if (!ride) {
    return (
      <div className="max-w-3xl mx-auto mt-12 p-8 bg-[#111] border border-white/10 rounded-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mr-4"></div>
        <span className="text-white font-light">Loading journey details...</span>
      </div>
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(ride.status);

  return (
    <div className="max-w-3xl mx-auto mt-8 p-8 bg-[#111] border border-white/10 rounded-3xl shadow-2xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">Live Journey</span>
          <h1 className="text-2xl font-light text-white mt-1">
            Status: <span className="text-[#d4af37] font-medium">{STEP_LABELS[ride.status] || ride.status}</span>
          </h1>
        </div>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">
          &larr; Dashboard
        </Link>
      </div>

      {/* Live Stepper */}
      {ride.status !== "CANCELLED" ? (
        <div className="my-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 w-full z-0"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-[#d4af37] transition-all duration-500 z-0"
              style={{
                width: `${Math.max(0, (currentStepIndex / (STEP_ORDER.length - 1)) * 100)}%`
              }}
            ></div>

            {STEP_ORDER.map((step, idx) => {
              const isCompleted = currentStepIndex > idx;
              const isCurrent = currentStepIndex === idx;

              return (
                <div key={step} className="relative z-10 flex flex-col items-center">
                  <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                      isCompleted 
                        ? "bg-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]" 
                        : isCurrent 
                        ? "bg-white text-black ring-4 ring-[#d4af37]/40 animate-pulse" 
                        : "bg-[#222] text-gray-500 border border-white/10"
                    }`}
                  >
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <span className={`text-[10px] mt-2 font-medium tracking-tight whitespace-nowrap ${
                    isCurrent ? "text-white" : isCompleted ? "text-[#d4af37]" : "text-gray-500"
                  }`}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="my-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          This ride has been cancelled.
        </div>
      )}

      {/* Ride Details */}
      <div className="space-y-4 text-gray-300 font-light bg-black/40 p-5 rounded-2xl border border-white/5 my-6">
        <div className="flex items-start gap-3">
          <span className="text-green-400 mt-0.5">●</span>
          <div>
            <span className="text-xs text-gray-500 block">Pickup</span>
            <span className="text-sm text-white font-medium">{ride.pickupAddress}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-[#d4af37] mt-0.5">■</span>
          <div>
            <span className="text-xs text-gray-500 block">Destination</span>
            <span className="text-sm text-white font-medium">{ride.dropAddress}</span>
          </div>
        </div>
        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-400">Vehicle Type: <strong className="text-white">{ride.vehicleType}</strong></span>
          <span className="text-sm text-[#d4af37] font-semibold">₹{ride.fareEstimatePaise / 100}</span>
        </div>
      </div>

      {/* Finding your driver state */}
      {ride.status === "REQUESTED" && (
        <div className="mt-8 flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-2xl">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-lg text-[#d4af37] font-light">Finding your driver...</p>
          <p className="text-xs text-gray-500 mt-1 mb-6">Contacting nearby Veloce chauffeurs</p>

          <button
            id="cancel-ride-btn"
            onClick={handleCancelRide}
            disabled={cancelling}
            className="px-6 py-2.5 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs tracking-wider uppercase transition-colors"
          >
            {cancelling ? "Cancelling..." : "Cancel Ride"}
          </button>
        </div>
      )}

      {/* Driver details card (Shows when ACCEPTED, ARRIVED, IN_PROGRESS, or COMPLETED) */}
      {driver && ride.status !== "REQUESTED" && (
        <div id="driver-details-card" className="mt-8 p-6 bg-gradient-to-br from-white/10 to-white/5 border border-[#d4af37]/40 rounded-2xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-xl">
                🕴️
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{driver.name}</h3>
                <p className="text-xs text-gray-400">⭐ {driver.avgRating || 4.9} • Veloce Chauffeur</p>
              </div>
            </div>
            <a 
              href={`tel:${driver.phone}`} 
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium text-white transition-colors"
            >
              📞 Call Chauffeur
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-gray-500 block">Vehicle</span>
              <span className="text-white font-medium">{driver.vehicleModel || "Mercedes-Benz E-Class"}</span>
            </div>
            <div>
              <span className="text-gray-500 block">License Plate</span>
              <span className="text-white font-mono font-medium">{driver.plateNumber || "DL 01 AB 1234"}</span>
            </div>
          </div>
        </div>
      )}

      {ride.status === "COMPLETED" && (
        <div className="mt-8 text-center p-6 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-2xl">
          <span className="text-3xl">🎉</span>
          <h2 className="text-lg font-medium text-white mt-2">You have arrived at your destination!</h2>
          <p className="text-xs text-gray-400 mt-1 mb-4">Thank you for riding with Veloce.</p>
          <button 
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2.5 bg-[#d4af37] text-black font-medium text-xs rounded-xl hover:bg-[#b08d2c] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
