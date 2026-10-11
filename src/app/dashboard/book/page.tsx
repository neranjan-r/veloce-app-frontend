"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const Map = dynamic(() => import("@/components/MapComponent"), { ssr: false });

type LocationState = { address: string; lat: number; lng: number } | null;

export default function BookRidePage() {
  const router = useRouter();
  const { fetchApi } = useApi();
  
  const [pickupInput, setPickupInput] = useState("");
  const [dropoffInput, setDropoffInput] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<any[]>([]);
  
  const [pickup, setPickup] = useState<LocationState>(null);
  const [dropoff, setDropoff] = useState<LocationState>(null);
  
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [fares, setFares] = useState<any>(null);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (pickupInput.length > 2 && pickup?.address !== pickupInput) {
        try {
          const res = await fetchApi(`/api/geocode/search?q=${encodeURIComponent(pickupInput)}`);
          setPickupSuggestions(res.data.slice(0, 5));
        } catch (e) {
          console.error("Pickup search error", e);
        }
      } else {
        setPickupSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pickupInput, pickup, fetchApi]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (dropoffInput.length > 2 && dropoff?.address !== dropoffInput) {
        try {
          const res = await fetchApi(`/api/geocode/search?q=${encodeURIComponent(dropoffInput)}`);
          setDropoffSuggestions(res.data.slice(0, 5));
        } catch (e) {
          console.error("Dropoff search error", e);
        }
      } else {
        setDropoffSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [dropoffInput, dropoff, fetchApi]);

  // Fetch estimate when both are set
  useEffect(() => {
    if (pickup && dropoff) {
      const getEstimate = async () => {
        setEstimateLoading(true);
        try {
          const res = await fetchApi("/api/rides/estimate", {
            method: "POST",
            body: JSON.stringify({ pickup, drop: dropoff, vehicleType: "Veloce X" }),
          });
          setFares(res.data);
        } catch (e: any) {
          console.error("Estimate failed", e);
        } finally {
          setEstimateLoading(false);
        }
      };
      getEstimate();
    }
  }, [pickup, dropoff, fetchApi]);

  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetchApi(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          setPickup({ address: res.data, lat: latitude, lng: longitude });
          setPickupInput(res.data);
        } catch (e) {
          console.error("Geolocation error", e);
        }
      });
    }
  };

  const handlePickupDrag = async (latlng: any) => {
    const res = await fetchApi(`/api/geocode/reverse?lat=${latlng.lat}&lng=${latlng.lng}`);
    setPickup({ address: res.data, lat: latlng.lat, lng: latlng.lng });
    setPickupInput(res.data);
  };

  const handleDropoffDrag = async (latlng: any) => {
    const res = await fetchApi(`/api/geocode/reverse?lat=${latlng.lat}&lng=${latlng.lng}`);
    setDropoff({ address: res.data, lat: latlng.lat, lng: latlng.lng });
    setDropoffInput(res.data);
  };

  const [bookingLoading, setBookingLoading] = useState(false);
  const handleConfirm = async () => {
    if (!pickup || !dropoff) return;
    setBookingLoading(true);
    try {
      const res = await fetchApi("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupAddress: pickup.address,
          dropLat: dropoff.lat,
          dropLng: dropoff.lng,
          dropAddress: dropoff.address,
          vehicleType: "Veloce X"
        })
      });
      router.push(`/dashboard/ride/${res.data.id}`);
    } catch (e) {
      console.error(e);
      alert("Failed to book ride");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500 mt-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-wide text-white">Book a Ride</h1>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
          <span>&larr;</span> Back
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Minimal Map Component */}
        <div className="lg:col-span-2 bg-[#111] rounded-2xl relative overflow-hidden flex items-center justify-center border border-white/5">
          <Map 
            pickup={pickup} 
            dropoff={dropoff} 
            routeGeometry={fares?.geometry} 
            onPickupDragEnd={handlePickupDrag} 
            onDropoffDragEnd={handleDropoffDrag} 
          />
        </div>

        {/* Minimal Booking Form */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6 flex flex-col relative z-20">
          <form className="flex flex-col gap-5 flex-1">
            <div className="space-y-4 relative">
              <div className="absolute left-[1.1rem] top-6 bottom-6 w-[1px] bg-white/10 z-0"></div>
              
              <div className="relative z-10">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"></div>
                <input 
                  type="text" 
                  value={pickupInput}
                  onChange={(e) => setPickupInput(e.target.value)}
                  placeholder="Pickup location" 
                  className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-12 pr-10 text-sm font-light text-white outline-none focus:border-white/20 transition-all placeholder:text-gray-500" 
                />
                <button type="button" onClick={handleUseLocation} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" title="Use my location">📍</button>
                {pickupSuggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-lg mt-1 z-50 overflow-hidden shadow-2xl">
                    {pickupSuggestions.map((s, i) => (
                      <li key={i} className="p-3 text-sm text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" onClick={() => {
                        setPickup({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                        setPickupInput(s.display_name);
                        setPickupSuggestions([]);
                      }}>{s.display_name}</li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="relative z-10">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-white"></div>
                <input 
                  type="text" 
                  value={dropoffInput}
                  onChange={(e) => setDropoffInput(e.target.value)}
                  placeholder="Where to?" 
                  className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm font-light text-white outline-none focus:border-white/20 transition-all placeholder:text-gray-500" 
                />
                {dropoffSuggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 bg-[#1a1a1a] border border-white/10 rounded-lg mt-1 z-50 overflow-hidden shadow-2xl">
                    {dropoffSuggestions.map((s, i) => (
                      <li key={i} className="p-3 text-sm text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" onClick={() => {
                        setDropoff({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                        setDropoffInput(s.display_name);
                        setDropoffSuggestions([]);
                      }}>{s.display_name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 flex-1">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Options</h3>
              <div className="space-y-3">
                {estimateLoading ? (
                  <div className="text-center text-gray-500 text-sm py-4">Calculating fares...</div>
                ) : fares ? (
                  <button type="button" className="w-full flex items-center justify-between p-4 bg-[#1a1a1a] border border-white/10 rounded-xl hover:border-white/30 transition-all">
                    <div className="flex items-center gap-4">
                      <span className="text-xl">🚙</span>
                      <div className="text-left">
                        <div className="text-sm font-medium text-white">Veloce X</div>
                        <div className="text-xs text-gray-500">4 seats • {Math.round(fares.durationSeconds/60)} min away</div>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-white">₹{fares.fareEstimatePaise / 100}</span>
                  </button>
                ) : (
                  <div className="text-center text-gray-500 text-sm py-4">Enter destinations to see fares</div>
                )}
              </div>
            </div>

            <button type="button" onClick={handleConfirm} disabled={!fares || estimateLoading || bookingLoading} className="w-full rounded-xl bg-white py-4 text-sm font-medium text-black hover:bg-gray-200 transition-colors mt-auto disabled:opacity-50">
              {bookingLoading ? "Booking..." : "Confirm Veloce X"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
