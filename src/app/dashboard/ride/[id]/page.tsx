"use client";

import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useApi } from "@/lib/api";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";

const Map = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-[#111] animate-pulse rounded-2xl border border-white/5 flex items-center justify-center text-gray-500 text-xs">
      Loading interactive map...
    </div>
  )
});

const STEP_ORDER = ["REQUESTED", "ACCEPTED", "ARRIVED", "IN_PROGRESS", "COMPLETED"];

const STEP_LABELS: Record<string, string> = {
  REQUESTED: "Finding Driver",
  ACCEPTED: "Driver Assigned",
  ARRIVED: "Driver Arrived",
  IN_PROGRESS: "Trip in Progress",
  COMPLETED: "Trip Completed",
  CANCELLED: "Trip Cancelled"
};

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleModel: string;
  plateNumber: string;
  avgRating: number;
  lat?: number;
  lng?: number;
}

interface PaymentInfo {
  id: string;
  status: string;
  amountPaise: number;
}

interface RideDetail {
  id: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  vehicleType: string;
  fareEstimatePaise: number;
  fareFinalPaise?: number | null;
  cancellationFeePaise?: number | null;
  driver?: DriverInfo | null;
  payment?: PaymentInfo | null;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

function RideContent() {
  const { id } = useParams();
  const { fetchApi } = useApi();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<{ coordinates?: [number, number][] } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Payment states
  const [isPaid, setIsPaid] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("new");
  const [newCardNumber, setNewCardNumber] = useState<string>("4242 4242 4242 4242");
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Rating states
  const [stars, setStars] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingSkipped, setRatingSkipped] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // SOS & Emergency tracking states
  const [sosActive, setSosActive] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Fetch real road route geometry
  useEffect(() => {
    if (!ride?.pickupLat || !ride?.dropLat) return;
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${ride.pickupLng},${ride.pickupLat};${ride.dropLng},${ride.dropLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.routes?.[0]?.geometry) {
          setRouteGeometry(data.routes[0].geometry);
        }
      } catch {
        // Fallback straight line handled in MapComponent
      }
    };
    fetchRoute();
  }, [ride?.pickupLat, ride?.pickupLng, ride?.dropLat, ride?.dropLng]);

  useEffect(() => {
    let s: Socket | null = null;

    const init = async () => {
      // 1. Fetch initial ride state
      try {
        const res = await fetchApi(`/api/rides/${id}`);
        if (res.data) {
          setRide(res.data);
          if (res.data.payment?.status === "PAID" || res.data.payment?.status === "SUCCEEDED") {
            setIsPaid(true);
          }
          if (res.data.driver) {
            setDriver(res.data.driver);
            if (res.data.driver.lat && res.data.driver.lng) {
              setDriverLocation({ lat: res.data.driver.lat, lng: res.data.driver.lng });
            }
          }
        }
      } catch (e: unknown) {
        console.error("Error fetching ride:", e);
      }

      // Fetch saved payment methods
      try {
        const pmRes = await fetchApi("/api/payments/methods");
        if (pmRes.data && pmRes.data.length > 0) {
          setSavedCards(pmRes.data);
          setSelectedCardId(pmRes.data[0].id);
        }
      } catch {
        // fallback
      }

      // 2. Connect socket for real-time lifecycle updates
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      s = io(apiUrl, {
        auth: { token: token || undefined },
        query: {
          userId: user?.id || "rider_guest",
          token: token || undefined
        }
      });

      s.on("connect", () => {
        console.log(`[Rider Socket] Connected. Joining ride:${id}`);
        s?.emit("ride:join", id);
      });

      s.on("ride:accepted", (data: { ride?: RideDetail; driver?: DriverInfo }) => {
        console.log("[Rider Socket] Received ride:accepted:", data);
        if (data.ride) setRide(data.ride);
        if (data.driver) {
          setDriver(data.driver);
          if (data.driver.lat && data.driver.lng) {
            setDriverLocation({ lat: data.driver.lat, lng: data.driver.lng });
          }
        }
      });

      s.on("ride:status", (data: { ride?: RideDetail; driver?: DriverInfo; status?: string }) => {
        console.log("[Rider Socket] Received ride:status:", data);
        if (data.ride) setRide(data.ride);
        if (data.status === "PAID" || data.status === "SUCCEEDED") setIsPaid(true);
        if (data.driver) {
          setDriver(data.driver);
          if (data.driver.lat && data.driver.lng) {
            setDriverLocation({ lat: data.driver.lat, lng: data.driver.lng });
          }
        }
      });

      s.on("ride:paid", () => {
        setIsPaid(true);
      });

      s.on("driver:location", (data: { lat: number; lng: number }) => {
        console.log("[Rider Socket] Received driver:location:", data);
        if (data?.lat && data?.lng) {
          setDriverLocation({ lat: data.lat, lng: data.lng });
        }
      });

      s.on("ride:cancelled", (data: { ride?: RideDetail }) => {
        console.log("[Rider Socket] Received ride:cancelled:", data);
        if (data.ride) setRide(data.ride);
      });

      s.on("sos:alert", (data: { trackingUrl?: string }) => {
        console.log("[Rider Socket] Received sos:alert:", data);
        setSosActive(true);
        if (data.trackingUrl) setTrackingUrl(data.trackingUrl);
      });
    };

    init();

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [id, fetchApi, getToken, user]);

  // Resilient fallback poller for real-time ride and driver updates
  useEffect(() => {
    if (!id || ride?.status === "COMPLETED" || ride?.status === "CANCELLED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetchApi(`/api/rides/${id}`);
        if (res.data) {
          setRide(res.data);
          if (res.data.payment?.status === "PAID" || res.data.payment?.status === "SUCCEEDED") {
            setIsPaid(true);
          }
          if (res.data.driver) {
            setDriver(res.data.driver);
            if (res.data.driver.lat && res.data.driver.lng) {
              setDriverLocation({ lat: res.data.driver.lat, lng: res.data.driver.lng });
            }
          }
        }
      } catch (err) {
        // silent
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [id, ride?.status, fetchApi]);

  const handleCancelRide = async () => {
    if (!confirm("Are you sure you want to cancel this ride? Note: cancellation after 2 minutes of chauffeur assignment incurs a ₹20 fee.")) return;
    setCancelling(true);
    try {
      const res = await fetchApi(`/api/rides/${id}/cancel`, { method: "POST" });
      setRide(res.data);
    } catch (e: unknown) {
      console.error("Error cancelling ride:", e);
      alert("Failed to cancel ride.");
    } finally {
      setCancelling(false);
    }
  };

  const handleTriggerSos = async () => {
    if (!confirm("Are you sure you want to activate EMERGENCY SOS? This will alert Veloce Safety Monitoring and generate a public tracking link for your trusted contacts.")) return;
    setSosLoading(true);
    try {
      const res = await fetchApi(`/api/rides/${id}/sos`, {
        method: "POST",
        body: JSON.stringify({ lat: driverLocation?.lat, lng: driverLocation?.lng })
      });
      if (res.data?.success) {
        setSosActive(true);
        setTrackingUrl(res.data.trackingUrl);
      }
    } catch (e: unknown) {
      console.error("SOS trigger error:", e);
      alert("Failed to activate emergency SOS beacon.");
    } finally {
      setSosLoading(false);
    }
  };

  const handleCopyTracking = () => {
    if (!trackingUrl) return;
    const fullUrl = `${window.location.origin}${trackingUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 3000);
  };

  const handlePay = async () => {
    setPaying(true);
    setPaymentError(null);
    try {
      const methodId = selectedCardId === "new" ? newCardNumber.replace(/\s+/g, "") : selectedCardId;
      const res = await fetchApi(`/api/rides/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentMethodId: methodId })
      });

      if (res.data?.success) {
        setIsPaid(true);
      } else {
        throw new Error(res.error?.message || "Payment processing failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Your card was declined. Please try another card.";
      setPaymentError(msg);
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitRating = async () => {
    setSubmittingRating(true);
    setRatingError(null);
    try {
      const res = await fetchApi(`/api/rides/${id}/rating`, {
        method: "POST",
        body: JSON.stringify({ stars, comment: comment.trim() || undefined })
      });
      if (res.data?.success) {
        setRatingSubmitted(true);
        if (res.data.avgRating && driver) {
          setDriver(prev => prev ? { ...prev, avgRating: res.data.avgRating } : prev);
        }
      } else {
        throw new Error(res.error?.message || "Rating submission failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rating submission failed";
      setRatingError(msg);
    } finally {
      setSubmittingRating(false);
    }
  };

  if (!ride) {
    return (
      <div className="max-w-4xl mx-auto mt-12 p-8 bg-[#111] border border-white/10 rounded-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mr-4"></div>
        <span className="text-white font-light">Loading journey details...</span>
      </div>
    );
  }

  const currentStepIndex = STEP_ORDER.indexOf(ride.status);
  const fareRupees = Math.round((ride.fareFinalPaise || ride.fareEstimatePaise) / 100);

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6 sm:p-8 bg-[#111] border border-white/10 rounded-3xl shadow-2xl text-white pb-16">
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

      {/* Live Map with Route and Driver Marker */}
      <div className="mt-6 mb-8 h-72 sm:h-80 rounded-2xl overflow-hidden border border-white/10 relative">
        <Map
          pickup={{ lat: ride.pickupLat, lng: ride.pickupLng }}
          dropoff={{ lat: ride.dropLat, lng: ride.dropLng }}
          driverLocation={
            ride.status === "COMPLETED"
              ? (driverLocation || { lat: ride.dropLat, lng: ride.dropLng })
              : driverLocation
          }
          routeGeometry={routeGeometry}
        />
        {ride.status === "COMPLETED" ? (
          <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur border border-emerald-500/40 px-3 py-1.5 rounded-full text-[11px] text-emerald-400 flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Journey Completed • Arrived at Destination
          </div>
        ) : driverLocation ? (
          <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur border border-[#d4af37]/40 px-3 py-1.5 rounded-full text-[11px] text-[#d4af37] flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-ping"></span>
            Driver Live Location
          </div>
        ) : null}
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
        <div className="my-6 p-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-1">
          <div className="font-semibold text-sm text-red-400">Journey Cancelled</div>
          <p>This ride request has been cancelled.</p>
          {ride.cancellationFeePaise && ride.cancellationFeePaise > 0 ? (
            <div className="pt-2 text-white font-medium">
              Cancellation Fee: <span className="text-[#d4af37]">₹{Math.round(ride.cancellationFeePaise / 100)}</span> (applied as cancellation occurred &gt;2 minutes post chauffeur assignment).
            </div>
          ) : (
            <div className="pt-1 text-emerald-400 text-[11px]">
              No cancellation fee was applied (cancelled within grace period).
            </div>
          )}
        </div>
      )}

      {/* SOS Active Beacon Banner */}
      {sosActive && (
        <div className="my-6 p-5 rounded-2xl bg-red-500/20 border-2 border-red-500/80 text-white space-y-3 animate-pulse shadow-2xl shadow-red-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">EMERGENCY PROTOCOL ACTIVE</h4>
                <p className="text-xs text-red-200">Safety response dispatch notified with live coordinates.</p>
              </div>
            </div>
            {trackingUrl && (
              <button
                type="button"
                onClick={handleCopyTracking}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-xl hover:bg-gray-200 transition-colors"
              >
                {copiedTracking ? "✓ Link Copied!" : "Share Emergency Link"}
              </button>
            )}
          </div>
          {trackingUrl && (
            <p className="text-[11px] text-gray-300 font-mono">
              Emergency tracking link: <span className="text-[#d4af37] underline">{trackingUrl}</span>
            </p>
          )}
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
          <span className="text-sm text-[#d4af37] font-semibold">₹{fareRupees}</span>
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
            {cancelling ? "Cancelling..." : "Cancel Ride (Free in Finding Phase)"}
          </button>
        </div>
      )}

      {/* Driver details card & Live Safety Controls */}
      {driver && ride.status !== "REQUESTED" && (
        <div id="driver-details-card" className="mt-8 p-4 sm:p-6 bg-gradient-to-br from-white/10 to-white/5 border border-[#d4af37]/40 rounded-2xl animate-in fade-in duration-300 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#d4af37]/20 border border-[#d4af37] flex items-center justify-center text-lg sm:text-xl shrink-0">
                🕴️
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-white">{driver.name}</h3>
                <p className="text-xs text-gray-400">⭐ {driver.avgRating || 4.9} • Veloce Chauffeur</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <a 
                href={`tel:${driver.phone}`} 
                aria-label={`Call chauffeur ${driver.name}`}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl text-xs font-medium text-white transition-colors"
              >
                📞 Call
              </a>

              {/* SOS Emergency Beacon Button */}
              {["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(ride.status) && (
                <button
                  id="sos-button"
                  type="button"
                  aria-label="Activate Emergency SOS Beacon"
                  onClick={handleTriggerSos}
                  disabled={sosLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-900/50 flex items-center gap-1.5"
                >
                  <span>🚨</span> {sosLoading ? "Activating..." : "SOS Emergency"}
                </button>
              )}
            </div>
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

          {["ACCEPTED", "ARRIVED"].includes(ride.status) && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleCancelRide}
                disabled={cancelling}
                className="text-[11px] text-gray-500 hover:text-red-400 transition-colors underline"
              >
                {cancelling ? "Cancelling..." : "Cancel Ride (₹20 fee applies after 2 mins)"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* COMPLETED State & Checkout / Rating Screen */}
      {ride.status === "COMPLETED" && (
        <div className="mt-8 p-6 sm:p-8 bg-[#161616] border border-[#d4af37]/50 rounded-3xl shadow-2xl">
          {isPaid ? (
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <h2 className="text-xl font-medium text-white">Payment Settled</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Total fare of <strong className="text-[#d4af37]">₹{fareRupees}</strong> paid via 256-bit encrypted checkout.
                </p>
              </div>

              {/* Download Receipt Button */}
              <div>
                <a
                  href={`http://localhost:4000/api/rides/${id}/receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-[#d4af37] border border-[#d4af37]/30 hover:border-[#d4af37] text-xs font-medium rounded-xl transition-all"
                >
                  📄 Download Official Receipt (PDF)
                </a>
              </div>

              {/* Rating Component */}
              {!ratingSubmitted && !ratingSkipped ? (
                <div className="max-w-md mx-auto p-5 rounded-2xl bg-black/40 border border-white/10 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">Rate Your Chauffeur</span>
                    <button
                      onClick={() => setRatingSkipped(true)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Skip
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStars(s)}
                        className={`text-2xl transition-transform hover:scale-125 ${
                          s <= stars ? "text-amber-400" : "text-gray-600"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <label htmlFor="rating-feedback-input" className="sr-only">Feedback Comment</label>
                  <textarea
                    id="rating-feedback-input"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, 300))}
                    placeholder="Share feedback on your chauffeur experience (optional, max 300 chars)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4af37] focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                    rows={2}
                  />
                  {ratingError && (
                    <p className="text-xs text-red-400">{ratingError}</p>
                  )}
                  <button
                    onClick={handleSubmitRating}
                    disabled={submittingRating}
                    className="w-full py-2.5 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] transition-colors"
                  >
                    {submittingRating ? "Submitting..." : `Submit ${stars}-Star Rating`}
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-emerald-400 max-w-sm mx-auto">
                  {ratingSubmitted ? "★ Thank you! Your rating has updated the chauffeur ledger." : "Rating skipped."}
                </div>
              )}

              <div className="pt-2 flex justify-center gap-4">
                <Link
                  href="/dashboard/history"
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
                >
                  View Itinerary
                </Link>
                <Link
                  href="/dashboard"
                  className="px-6 py-2.5 bg-[#d4af37] text-black font-semibold text-xs rounded-xl hover:bg-[#b08d2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] transition-colors"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Payment Required</span>
                  <h2 className="text-xl font-medium text-white">Settle Trip Fare</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Amount Due</span>
                  <span className="text-2xl font-bold text-[#d4af37]">₹{fareRupees}</span>
                </div>
              </div>

              {paymentError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs flex items-center justify-between">
                  <span>{paymentError}</span>
                  <button onClick={() => setPaymentError(null)} className="text-xs underline ml-2">Dismiss</button>
                </div>
              )}

              {/* Saved Cards Picker */}
              <div className="space-y-3">
                <span className="text-xs text-gray-400 uppercase tracking-wider block font-medium">Select Payment Method</span>
                {savedCards.map(card => (
                  <label
                    key={card.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedCardId === card.id ? "border-[#d4af37] bg-white/10" : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={selectedCardId === card.id}
                        onChange={() => setSelectedCardId(card.id)}
                        className="accent-[#d4af37]"
                      />
                      <span className="text-xs font-mono text-white">•••• •••• •••• {card.last4}</span>
                      <span className="text-[10px] uppercase bg-white/10 text-gray-400 px-2 py-0.5 rounded">{card.brand}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{card.expMonth}/{card.expYear}</span>
                  </label>
                ))}

                {/* Option for New / Test Card */}
                <label
                  className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedCardId === "new" ? "border-[#d4af37] bg-white/10" : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selectedCardId === "new"}
                      onChange={() => setSelectedCardId("new")}
                      className="accent-[#d4af37]"
                    />
                    <span className="text-xs font-medium text-white">Use New / Test Card</span>
                  </div>

                  {selectedCardId === "new" && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <label htmlFor="test-card-input" className="text-[11px] text-gray-400 block font-medium">
                        Enter Card Number:
                      </label>
                      <input
                        id="test-card-input"
                        type="text"
                        value={newCardNumber}
                        onChange={(e) => setNewCardNumber(e.target.value)}
                        placeholder="Card Number"
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#d4af37] focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                      />
                      <p className="text-[10px] text-gray-500">
                        Try <span className="text-[#d4af37] font-mono">4242 4242 4242 4242</span> (success) or <span className="text-red-400 font-mono">4000 0000 0000 0002</span> (decline)
                      </p>
                    </div>
                  )}
                </label>
              </div>

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full py-4 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-all shadow-[0_0_25px_rgba(212,175,55,0.25)] flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Processing Payment...
                  </>
                ) : (
                  `Authorize Payment of ₹${fareRupees}`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RidePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-gray-400 font-light">Loading journey details...</p>
        </div>
      }
    >
      <RideContent />
    </Suspense>
  );
}
