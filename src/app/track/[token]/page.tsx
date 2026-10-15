"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";

const Map = dynamic(() => import("@/components/MapComponent"), { ssr: false });

interface Stop {
  id: string;
  position: number;
  lat: number;
  lng: number;
  address: string;
}

interface TrackData {
  ride: {
    id: string;
    status: string;
    vehicleType: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropAddress: string;
    dropLat: number;
    dropLng: number;
    createdAt: string;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
    vehicleType: string;
    vehicleModel: string;
    plateNumber: string;
    avgRating: number;
    lat: number;
    lng: number;
  } | null;
  stops?: Stop[];
  sosActive: boolean;
  sosEvent?: {
    lat: number;
    lng: number;
    createdAt: string;
  } | null;
  expiresAt: number;
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Dispatching Chauffeur",
  ACCEPTED: "Chauffeur En Route",
  ARRIVED: "Chauffeur Arrived at Pickup",
  IN_PROGRESS: "Journey in Progress",
  COMPLETED: "Journey Completed Safely",
  CANCELLED: "Journey Cancelled"
};

function PublicTrackingContent() {
  const { token } = useParams();
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/rides/track/${token}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
        setError(null);
      } else {
        throw new Error(json.error?.message || "Invalid or expired tracking link");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to load live journey tracking";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackData();
    const interval = setInterval(fetchTrackData, 4000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm tracking-widest uppercase text-[#d4af37]">Verifying Emergency Tracking Link...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl mb-4">
          ⚠
        </div>
        <h1 className="text-xl font-medium mb-2">Tracking Link Expired or Invalid</h1>
        <p className="text-xs text-gray-400 max-w-md mb-6">{error || "This emergency journey link has expired or is invalid."}</p>
        <Link
          href="/"
          className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-xs rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
        >
          Return to Veloce Home
        </Link>
      </div>
    );
  }

  const { ride, driver, stops, sosActive } = data;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-light tracking-widest text-[#d4af37]">VELOCE</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              TRUSTED CONTACT LINK
            </span>
          </div>
          <span className="text-xs text-gray-500 font-mono">12-Hour Encrypted Session</span>
        </div>

        {/* SOS Emergency Banner if Active */}
        {sosActive && (
          <div className="p-4 sm:p-6 rounded-2xl bg-red-500/15 border-2 border-red-500/80 animate-pulse text-red-200 space-y-2 shadow-2xl shadow-red-950">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <h2 className="text-base font-bold text-red-400 tracking-wide uppercase">
                  EMERGENCY PROTOCOL ACTIVE
                </h2>
                <p className="text-xs text-red-300">
                  Passenger activated the emergency SOS beacon on this ride. Safety monitoring response has been dispatched.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Header Card */}
        <div className="p-6 bg-[#121212] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Live Ride Monitor</span>
            <h1 className="text-xl sm:text-2xl font-light text-white mt-1">
              {STATUS_LABELS[ride.status] || ride.status}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Vehicle: {ride.vehicleType}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
            <span className="text-xs font-mono text-emerald-400">Live GPS Polling</span>
          </div>
        </div>

        {/* Map */}
        <div className="h-80 sm:h-96 rounded-2xl overflow-hidden border border-white/10 relative">
          <Map
            pickup={{ lat: ride.pickupLat, lng: ride.pickupLng }}
            dropoff={{ lat: ride.dropLat, lng: ride.dropLng }}
            driverLocation={driver ? { lat: driver.lat, lng: driver.lng } : null}
          />
        </div>

        {/* Route Details with Intermediate Stops */}
        <div className="p-6 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Journey Itinerary</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 mt-1 shrink-0"></div>
              <div>
                <span className="text-[10px] uppercase text-gray-500 block">Pickup Location</span>
                <span className="text-xs text-white font-medium">{ride.pickupAddress}</span>
              </div>
            </div>

            {stops && stops.length > 0 && stops.map((s, idx) => (
              <div key={s.id || idx} className="flex items-start gap-3 pl-0.5">
                <div className="w-2 h-2 rounded-full bg-[#d4af37] mt-1.5 shrink-0"></div>
                <div>
                  <span className="text-[10px] uppercase text-[#d4af37] block">Intermediate Stop {s.position}</span>
                  <span className="text-xs text-white font-medium">{s.address}</span>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-400 mt-1 shrink-0"></div>
              <div>
                <span className="text-[10px] uppercase text-gray-500 block">Final Destination</span>
                <span className="text-xs text-white font-medium">{ride.dropAddress}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chauffeur Information */}
        {driver && (
          <div className="p-6 bg-[#121212] border border-white/10 rounded-2xl space-y-4">
            <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Assigned Chauffeur</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Chauffeur</span>
                <span className="text-white font-medium">{driver.name}</span>
                <span className="text-[10px] text-[#d4af37] block">★ {driver.avgRating.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Vehicle Model</span>
                <span className="text-white font-medium">{driver.vehicleModel}</span>
              </div>
              <div>
                <span className="text-gray-500 block">License Plate</span>
                <span className="text-white font-mono font-medium">{driver.plateNumber}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Phone</span>
                <a href={`tel:${driver.phone}`} className="text-emerald-400 font-mono font-medium hover:underline">
                  {driver.phone}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-gray-400 font-light">Loading live journey tracking...</p>
        </div>
      }
    >
      <PublicTrackingContent />
    </Suspense>
  );
}
