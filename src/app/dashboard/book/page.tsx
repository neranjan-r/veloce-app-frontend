"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const Map = dynamic(() => import("@/components/MapComponent"), { ssr: false });

type LocationState = { address: string; lat: number; lng: number } | null;

interface SuggestionItem {
  display_name: string;
  lat: string;
  lon: string;
  [key: string]: unknown;
}

interface IntermediateStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  input: string;
  suggestions: SuggestionItem[];
}

export default function BookRidePage() {
  const router = useRouter();
  const { fetchApi } = useApi();
  
  const [pickupInput, setPickupInput] = useState("");
  const [dropoffInput, setDropoffInput] = useState("");
  const [pickupSuggestions, setPickupSuggestions] = useState<SuggestionItem[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<SuggestionItem[]>([]);
  
  const [pickup, setPickup] = useState<LocationState>(null);
  const [dropoff, setDropoff] = useState<LocationState>(null);
  const [stops, setStops] = useState<IntermediateStop[]>([]);
  
  // Promo code states
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPaise: number;
    discountedFarePaise: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const [estimateLoading, setEstimateLoading] = useState(false);
  const [fares, setFares] = useState<{
    baseFarePaise?: number;
    fareEstimatePaise?: number;
    discountPaise?: number;
    durationSeconds?: number;
    distanceMeters?: number;
    geometry?: any;
    options?: Array<{ tier: string; farePaise: number }>;
    [key: string]: any;
  } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Debounce search pickup
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

  // Debounce search dropoff
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

  // Fetch estimate when pickup, dropoff, or stops change
  useEffect(() => {
    if (pickup && dropoff) {
      const getEstimate = async () => {
        setEstimateLoading(true);
        try {
          const validStops = stops
            .filter(s => s.lat && s.lng)
            .map(s => ({ lat: s.lat, lng: s.lng, address: s.address }));

          const res = await fetchApi("/api/rides/estimate", {
            method: "POST",
            body: JSON.stringify({
              pickup,
              drop: dropoff,
              stops: validStops.length > 0 ? validStops : undefined,
              vehicleType: "Veloce X",
              promoCode: appliedPromo?.code || undefined
            }),
          });
          setFares(res.data);
        } catch (e: unknown) {
          console.error("Estimate failed", e);
        } finally {
          setEstimateLoading(false);
        }
      };
      getEstimate();
    }
  }, [pickup, dropoff, stops, appliedPromo, fetchApi]);

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

  const handlePickupDrag = async (latlng: { lat: number; lng: number }) => {
    const res = await fetchApi(`/api/geocode/reverse?lat=${latlng.lat}&lng=${latlng.lng}`);
    setPickup({ address: res.data, lat: latlng.lat, lng: latlng.lng });
    setPickupInput(res.data);
  };

  const handleDropoffDrag = async (latlng: { lat: number; lng: number }) => {
    const res = await fetchApi(`/api/geocode/reverse?lat=${latlng.lat}&lng=${latlng.lng}`);
    setDropoff({ address: res.data, lat: latlng.lat, lng: latlng.lng });
    setDropoffInput(res.data);
  };

  // Intermediate Stop handlers
  const handleAddStop = () => {
    if (stops.length >= 3) return;
    const newStop: IntermediateStop = {
      id: "stop_" + Date.now(),
      address: "",
      lat: 0,
      lng: 0,
      input: "",
      suggestions: []
    };
    setStops(prev => [...prev, newStop]);
  };

  const handleRemoveStop = (id: string) => {
    setStops(prev => prev.filter(s => s.id !== id));
  };

  const handleStopInputChange = async (id: string, text: string) => {
    setStops(prev => prev.map(s => s.id === id ? { ...s, input: text } : s));
    if (text.length > 2) {
      try {
        const res = await fetchApi(`/api/geocode/search?q=${encodeURIComponent(text)}`);
        setStops(prev => prev.map(s => s.id === id ? { ...s, suggestions: res.data.slice(0, 4) } : s));
      } catch (e) {
        console.error(e);
      }
    } else {
      setStops(prev => prev.map(s => s.id === id ? { ...s, suggestions: [] } : s));
    }
  };

  const handleSelectStop = (id: string, suggestion: SuggestionItem) => {
    setStops(prev => prev.map(s => s.id === id ? {
      ...s,
      address: suggestion.display_name,
      input: suggestion.display_name,
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      suggestions: []
    } : s));
  };

  // Promo code apply handler
  const handleApplyPromo = async (codeToUse?: string) => {
    const targetCode = (codeToUse || promoCodeInput).trim().toUpperCase();
    if (!targetCode) return;
    setValidatingPromo(true);
    setPromoError(null);
    try {
      const currentFare = fares?.baseFarePaise || fares?.fareEstimatePaise || 12000;
      const res = await fetchApi("/api/rides/promo/validate", {
        method: "POST",
        body: JSON.stringify({ code: targetCode, fareEstimatePaise: currentFare })
      });
      if (res.data?.valid) {
        setAppliedPromo({
          code: res.data.code,
          discountPaise: res.data.discountPaise,
          discountedFarePaise: res.data.discountedFarePaise
        });
        setPromoCodeInput(res.data.code);
      } else {
        setAppliedPromo(null);
        setPromoError(res.data?.message || "Invalid promotional code");
      }
    } catch (e: unknown) {
      setPromoError((e as Error).message || "Failed to validate code");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError(null);
  };

  const handleConfirm = async () => {
    if (!pickup || !dropoff) return;
    setBookingLoading(true);
    try {
      const validStops = stops
        .filter(s => s.lat && s.lng)
        .map(s => ({ lat: s.lat, lng: s.lng, address: s.address }));

      const res = await fetchApi("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupAddress: pickup.address,
          dropLat: dropoff.lat,
          dropLng: dropoff.lng,
          dropAddress: dropoff.address,
          stops: validStops.length > 0 ? validStops : undefined,
          vehicleType: "Veloce X",
          promoCode: appliedPromo?.code || undefined
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

  const finalFarePaise = (fares && typeof fares.fareEstimatePaise === 'number') ? fares.fareEstimatePaise : 0;
  const fareRupees = Math.round(finalFarePaise / 100);
  const discountRupees = (fares && typeof fares.discountPaise === 'number') ? Math.round(fares.discountPaise / 100) : 0;

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in duration-500 mt-4 pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Chauffeur Booking</span>
          <h1 className="text-2xl font-light tracking-wide text-white">Reserve a Journey</h1>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
          <span>&larr;</span> Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Component */}
        <div className="lg:col-span-2 bg-[#111] rounded-2xl relative overflow-hidden border border-white/10 h-[520px] lg:h-full min-h-[500px]">
          <Map 
            pickup={pickup} 
            dropoff={dropoff} 
            routeGeometry={fares?.geometry} 
            onPickupDragEnd={handlePickupDrag} 
            onDropoffDragEnd={handleDropoffDrag} 
          />
        </div>

        {/* Booking Form with Multi-Stops & Promo Codes */}
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 flex flex-col space-y-5">
          {/* Pickup and Destination Inputs */}
          <div className="space-y-3 relative">
            {/* Pickup */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400"></div>
              <input 
                type="text" 
                value={pickupInput}
                onChange={(e) => setPickupInput(e.target.value)}
                placeholder="Pickup address" 
                className="w-full bg-[#181818] border border-white/10 rounded-xl py-3 pl-10 pr-10 text-xs font-light text-white outline-none focus:border-[#d4af37] transition-all placeholder:text-gray-500" 
              />
              <button type="button" onClick={handleUseLocation} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs" title="Use current location">📍</button>
              {pickupSuggestions.length > 0 && (
                <ul className="absolute top-full left-0 right-0 bg-[#1f1f1f] border border-white/10 rounded-xl mt-1 z-50 overflow-hidden shadow-2xl">
                  {pickupSuggestions.map((s, i) => (
                    <li key={i} className="p-2.5 text-xs text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" onClick={() => {
                      setPickup({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                      setPickupInput(s.display_name);
                      setPickupSuggestions([]);
                    }}>{s.display_name}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Intermediate Stops */}
            {stops.map((stop, index) => (
              <div key={stop.id} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#d4af37]"></div>
                  <input
                    type="text"
                    value={stop.input}
                    onChange={(e) => handleStopInputChange(stop.id, e.target.value)}
                    placeholder={`Stop ${index + 1} address`}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-light text-white outline-none focus:border-[#d4af37] transition-all placeholder:text-gray-500"
                  />
                  {stop.suggestions.length > 0 && (
                    <ul className="absolute top-full left-0 right-0 bg-[#1f1f1f] border border-white/10 rounded-xl mt-1 z-50 overflow-hidden shadow-2xl">
                      {stop.suggestions.map((s, i) => (
                        <li key={i} className="p-2.5 text-xs text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" onClick={() => handleSelectStop(stop.id, s)}>
                          {s.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStop(stop.id)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 text-xs flex items-center justify-center transition-colors"
                  title="Remove stop"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add Stop Button */}
            {stops.length < 3 && (
              <button
                type="button"
                onClick={handleAddStop}
                className="text-[11px] text-[#d4af37] hover:text-[#e5c453] font-medium flex items-center gap-1.5 py-1 transition-colors"
              >
                <span>+</span> Add Stop (up to 3)
              </button>
            )}

            {/* Destination */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-400"></div>
              <input 
                type="text" 
                value={dropoffInput}
                onChange={(e) => setDropoffInput(e.target.value)}
                placeholder="Where to? (Destination)" 
                className="w-full bg-[#181818] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-light text-white outline-none focus:border-[#d4af37] transition-all placeholder:text-gray-500" 
              />
              {dropoffSuggestions.length > 0 && (
                <ul className="absolute top-full left-0 right-0 bg-[#1f1f1f] border border-white/10 rounded-xl mt-1 z-50 overflow-hidden shadow-2xl">
                  {dropoffSuggestions.map((s, i) => (
                    <li key={i} className="p-2.5 text-xs text-gray-300 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-0" onClick={() => {
                      setDropoff({ address: s.display_name, lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
                      setDropoffInput(s.display_name);
                      setDropoffSuggestions([]);
                    }}>{s.display_name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Promo Code Section */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">Promotional Code</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                placeholder="SAVE10, FIRST50, etc."
                className="flex-1 bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-xs text-white uppercase outline-none focus:border-[#d4af37]"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="px-3 py-2 bg-red-500/20 text-red-300 text-xs rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleApplyPromo()}
                  disabled={validatingPromo}
                  className="px-3 py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-lg hover:bg-[#b08d2c] transition-colors"
                >
                  {validatingPromo ? "..." : "Apply"}
                </button>
              )}
            </div>

            {/* Quick Promo Chips */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[9px] text-gray-500">Quick Promos:</span>
              {["SAVE10", "FIRST50", "WELCOME20"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleApplyPromo(code)}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-[#d4af37]/20 text-[10px] text-[#d4af37] font-mono transition-colors"
                >
                  {code}
                </button>
              ))}
            </div>

            {promoError && (
              <p className="text-[10px] text-red-400">{promoError}</p>
            )}
            {appliedPromo && (
              <p className="text-[10px] text-emerald-400">
                ✓ Promo {appliedPromo.code} applied (Saved ₹{Math.round(appliedPromo.discountPaise / 100)})
              </p>
            )}
          </div>

          {/* Vehicle Class & Fare Estimate */}
          <div className="flex-1 space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block">Vehicle Selection</span>
            {estimateLoading ? (
              <div className="text-center text-gray-500 text-xs py-4 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin"></div>
                <span>Calculating multi-stop routing & fare...</span>
              </div>
            ) : fares ? (
              <div className="p-3.5 bg-[#181818] border border-[#d4af37]/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚙</span>
                  <div>
                    <div className="text-xs font-semibold text-white">Veloce X</div>
                    <div className="text-[10px] text-gray-400">
                      {Math.round((fares.durationSeconds || 0) / 60)} min • {((fares.distanceMeters || 0) / 1000).toFixed(1)} km
                      {stops.length > 0 && ` • ${stops.length} stop(s)`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {discountRupees > 0 && (
                    <span className="text-[10px] line-through text-gray-500 block">
                      ₹{Math.round((fares.baseFarePaise || 0) / 100)}
                    </span>
                  )}
                  <span className="text-base font-bold text-[#d4af37]">₹{fareRupees}</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 text-xs py-4 bg-[#141414] rounded-xl border border-white/5">
                Enter pickup and drop destinations to view fares
              </div>
            )}
          </div>

          <button 
            type="button" 
            onClick={handleConfirm} 
            disabled={!fares || estimateLoading || bookingLoading} 
            className="w-full rounded-xl bg-[#d4af37] py-3.5 text-xs uppercase tracking-wider font-semibold text-black hover:bg-[#b08d2c] transition-colors disabled:opacity-40"
          >
            {bookingLoading ? "Confirming Dispatch..." : `Confirm Veloce X • ₹${fareRupees}`}
          </button>
        </div>
      </div>
    </div>
  );
}
