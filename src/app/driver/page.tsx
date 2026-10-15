"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full bg-[#111] animate-pulse rounded-2xl border border-white/5 flex items-center justify-center text-gray-500 text-xs">
      Loading cockpit map...
    </div>
  )
});

interface DriverRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  fareEstimatePaise: number;
  distanceMeters: number;
  vehicleType: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
}

export default function DriverDashboard() {
  const { user, isLoaded } = useUser();
  const rawRole = (user?.publicMetadata?.role as string | undefined)?.toUpperCase();
  const isDriverOrAdmin = rawRole === "DRIVER" || rawRole === "ADMIN";
  const [isOnline, setIsOnline] = useState(false);
  const [requests, setRequests] = useState<DriverRide[]>([]);
  const [activeRide, setActiveRide] = useState<DriverRide | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{
    id: string;
    fareEstimatePaise: number;
    pickupAddress: string;
    dropAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropLat?: number;
    dropLng?: number;
  } | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<{ coordinates?: [number, number][] } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const { fetchApi } = useApi();
  const { getToken } = useAuth();

  // Driver vehicle profile state
  const [vehicleModel, setVehicleModel] = useState("Mercedes-Benz E-Class");
  const [plateNumber, setPlateNumber] = useState("DL 01 AB 1234");
  const [vehicleType, setVehicleType] = useState("Veloce X");
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  useEffect(() => {
    fetchApi("/api/driver/profile")
      .then((res) => {
        if (res.data) {
          if (res.data.vehicleModel) setVehicleModel(res.data.vehicleModel);
          if (res.data.plateNumber) setPlateNumber(res.data.plateNumber);
          if (res.data.vehicleType) setVehicleType(res.data.vehicleType);
          if (res.data.isOnline) setIsOnline(true);
        }
      })
      .catch(console.error);

    // Check for any currently active trip for this chauffeur
    fetchApi("/api/rides/active")
      .then((res) => {
        if (res.data && ["ACCEPTED", "ARRIVED", "IN_PROGRESS"].includes(res.data.status)) {
          setActiveRide(res.data);
          setIsOnline(true);
          setStatusMessage(`Active Trip in progress (${res.data.status})`);
        }
      })
      .catch(console.error);
  }, [fetchApi]);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVehicle(true);
    try {
      const res = await fetchApi("/api/driver/profile", {
        method: "PUT",
        body: JSON.stringify({ vehicleType, vehicleModel, plateNumber }),
      });
      if (res.data) {
        setIsEditingVehicle(false);
        setStatusMessage("Vehicle profile updated successfully.");
      }
    } catch (err: unknown) {
      console.error("Save vehicle error:", err);
      setStatusMessage("Failed to update vehicle profile.");
    } finally {
      setSavingVehicle(false);
    }
  };

  // Dev-only coordinates override
  const isDev = process.env.NODE_ENV !== "production";
  const devLatStr = process.env.NEXT_PUBLIC_DEV_DRIVER_LAT;
  const devLngStr = process.env.NEXT_PUBLIC_DEV_DRIVER_LNG;
  const devLat = devLatStr ? parseFloat(devLatStr) : null;
  const devLng = devLngStr ? parseFloat(devLngStr) : null;
  const hasDevOverride = isDev && devLat !== null && !isNaN(devLat) && devLng !== null && !isNaN(devLng);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: devLat ?? 28.6315,
    lng: devLng ?? 77.2167
  });

  const getCoordinates = useCallback(async (): Promise<{ lat: number; lng: number }> => {
    if (hasDevOverride) {
      const c = { lat: devLat!, lng: devLng! };
      setCurrentCoords(c);
      return c;
    }
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentCoords(c);
            resolve(c);
          },
          () => {
            const c = { lat: 28.6315, lng: 77.2167 };
            setCurrentCoords(c);
            resolve(c);
          }
        );
      } else {
        const c = { lat: 28.6315, lng: 77.2167 };
        setCurrentCoords(c);
        resolve(c);
      }
    });
  }, [hasDevOverride, devLat, devLng]);

  // Fetch real road route geometry for active ride
  useEffect(() => {
    if (!activeRide?.pickupLat || !activeRide?.dropLat) {
      setRouteGeometry(null);
      return;
    }
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${activeRide.pickupLng},${activeRide.pickupLat};${activeRide.dropLng},${activeRide.dropLat}?overview=full&geometries=geojson`;
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
  }, [activeRide?.pickupLat, activeRide?.pickupLng, activeRide?.dropLat, activeRide?.dropLng]);

  useEffect(() => {
    let s: Socket | null = null;
    let watchId: number | null = null;

    const init = async () => {
      if (!isOnline) return;

      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      s = io(apiUrl, {
        auth: { token: token || undefined },
        query: {
          role: "DRIVER",
          vehicleType,
          token: token || undefined
        }
      });

      s.on("connect", () => {
        console.log("[Driver Socket] Connected successfully");
      });

      s.on("ride:requested", (ride: DriverRide) => {
        console.log("[Driver Socket] Received ride:requested:", ride);
        setRequests((prev: DriverRide[]) => {
          if (prev.some(r => r.id === ride.id)) return prev;
          return [ride, ...prev];
        });
      });

      s.on("ride:accepted", (data: { rideId: string }) => {
        console.log("[Driver Socket] Received ride:accepted:", data);
        setRequests((prev: DriverRide[]) => prev.filter(r => r.id !== data.rideId));
      });

      s.on("ride:cancelled", (data: { rideId: string }) => {
        console.log("[Driver Socket] Received ride:cancelled:", data);
        setRequests((prev: DriverRide[]) => prev.filter(r => r.id !== data.rideId));
        setActiveRide((prev: DriverRide | null) => (prev && prev.id === data.rideId ? null : prev));
      });

      // Fetch pending requests immediately
      try {
        const res = await fetchApi("/api/driver/requests");
        setRequests(res.data || []);
      } catch (e: unknown) {
        console.error("Error loading requests:", e);
      }

      // Initial location sync
      const coords = await getCoordinates();
      fetchApi("/api/driver/location", {
        method: "POST",
        body: JSON.stringify(coords)
      }).catch(console.error);

      if (navigator.geolocation && !hasDevOverride) {
        watchId = navigator.geolocation.watchPosition((pos) => {
          fetchApi("/api/driver/location", {
            method: "POST",
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          }).catch(console.error);
        });
      }
    };

    if (isOnline) {
      init();
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (s) {
        s.disconnect();
      }
    };
  }, [isOnline, fetchApi, getToken, hasDevOverride, devLat, devLng, vehicleType, getCoordinates]);

  // Periodic poller for pending requests to ensure real-time consistency
  useEffect(() => {
    if (!isOnline || activeRide) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetchApi("/api/driver/requests");
        if (res.data) setRequests(res.data);
      } catch (err) {
        // silent
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isOnline, activeRide, fetchApi]);

  // Live GPS movement simulator when on active trip
  useEffect(() => {
    if (!activeRide || (activeRide.status !== "ACCEPTED" && activeRide.status !== "IN_PROGRESS")) return;

    const targetLat = activeRide.status === "ACCEPTED" ? activeRide.pickupLat : activeRide.dropLat;
    const targetLng = activeRide.status === "ACCEPTED" ? activeRide.pickupLng : activeRide.dropLng;

    if (typeof targetLat !== "number" || typeof targetLng !== "number") return;

    let simLat = targetLat + (activeRide.status === "ACCEPTED" ? 0.003 : -0.003);
    let simLng = targetLng + (activeRide.status === "ACCEPTED" ? 0.003 : -0.003);

    const simInterval = setInterval(async () => {
      // Step 15% closer to target each tick
      simLat += (targetLat - simLat) * 0.15;
      simLng += (targetLng - simLng) * 0.15;
      setCurrentCoords({ lat: simLat, lng: simLng });

      try {
        await fetchApi("/api/driver/location", {
          method: "POST",
          body: JSON.stringify({ lat: simLat, lng: simLng })
        });
      } catch (err) {
        // silent
      }
    }, 2500);

    return () => clearInterval(simInterval);
  }, [activeRide, fetchApi]);

  const toggleOnline = async () => {
    try {
      if (isOnline) {
        await fetchApi("/api/driver/offline", { method: "POST" });
        setIsOnline(false);
        setRequests([]);
        setActiveRide(null);
        setStatusMessage("You are offline.");
      } else {
        const coords = await getCoordinates();
        await fetchApi("/api/driver/online", {
          method: "POST",
          body: JSON.stringify({ ...coords, vehicleType: "Veloce X" })
        });
        setIsOnline(true);
        setStatusMessage("Online • Ready for rides (Veloce X)");
      }
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to toggle online status.");
    }
  };

  const handleAccept = async (rideId: string) => {
    try {
      const res = await fetchApi(`/api/rides/${rideId}/accept`, { method: "POST" });
      setActiveRide(res.data.ride);
      setRequests((prev: DriverRide[]) => prev.filter(r => r.id !== rideId));
      setStatusMessage(`Accepted ride ${rideId}`);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Ride already accepted by another driver.";
      console.error(e);
      alert(errorMsg);
      setRequests((prev: DriverRide[]) => prev.filter(r => r.id !== rideId));
    }
  };

  const handleArrived = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/rides/${activeRide.id}/arrived`, { method: "POST" });
      setActiveRide(res.data);
      setStatusMessage("You have arrived at pickup location. Waiting for passenger.");
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to mark arrival at pickup");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(`/api/rides/${activeRide.id}/start`, { method: "POST" });
      setActiveRide(res.data);
      setStatusMessage("Ride is currently in progress. Driving to passenger destination.");
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to start ride");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    setActionLoading(true);
    try {
      const finishedRide = activeRide;
      await fetchApi(`/api/rides/${activeRide.id}/complete`, { method: "POST" });
      setActiveRide(null);
      setCompletedSummary({
        id: finishedRide.id,
        fareEstimatePaise: finishedRide.fareEstimatePaise,
        pickupAddress: finishedRide.pickupAddress,
        dropAddress: finishedRide.dropAddress,
        pickupLat: finishedRide.pickupLat,
        pickupLng: finishedRide.pickupLng,
        dropLat: finishedRide.dropLat,
        dropLng: finishedRide.dropLng,
      });
      setStatusMessage("Ride completed! Payout credited to your chauffeur ledger.");
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to complete ride");
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateDriver = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "DRIVER" }),
      });
      if (res.ok) {
        await user?.reload();
        window.location.reload();
      } else {
        alert("Failed to activate chauffeur role.");
      }
    } catch (e: unknown) {
      console.error(e);
      alert("Error activating chauffeur role.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoaded && !isDriverOrAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-2xl text-[#d4af37] mb-4">
          🕴️
        </div>
        <h1 className="text-2xl font-light text-white mb-2">Chauffeur Privileges Required</h1>
        <p className="text-xs text-gray-400 max-w-md mb-6">
          Your account is currently registered as a Client/Rider. You can instantly activate Chauffeur mode to accept rides and access the driver cockpit.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            id="activate-driver-mode-btn"
            onClick={handleActivateDriver}
            disabled={actionLoading}
            className="px-6 py-2.5 bg-[#d4af37] text-black font-semibold text-xs rounded-xl hover:bg-[#b08d2c] transition-colors shadow-lg disabled:opacity-50"
          >
            {actionLoading ? "Activating Chauffeur..." : "⚡ Activate Chauffeur Mode"}
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-white/10 text-white font-medium text-xs rounded-xl hover:bg-white/20 transition-colors"
          >
            Return to Passenger Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 bg-[#0a0a0a] min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-light text-white">Veloce <span className="text-[#d4af37]">Driver</span></h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
            <span>Vehicle: <strong className="text-white font-medium">{vehicleModel}</strong> ({vehicleType})</span>
            <span className="text-gray-500">•</span>
            <span>Plate: <strong className="text-white font-mono">{plateNumber}</strong></span>
            <button
              id="edit-vehicle-btn"
              onClick={() => setIsEditingVehicle(!isEditingVehicle)}
              className="ml-2 text-[10px] text-[#d4af37] underline hover:text-white"
            >
              {isEditingVehicle ? "Cancel" : "Edit Vehicle"}
            </button>
            {hasDevOverride && (
              <span className="text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/30">
                Dev Override: ({devLat}, {devLng})
              </span>
            )}
          </div>
        </div>
        <button 
          id="toggle-online-btn"
          onClick={toggleOnline}
          className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all ${
            isOnline ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" : "bg-white text-black hover:bg-gray-200"
          }`}
        >
          {isOnline ? "GO OFFLINE" : "GO ONLINE"}
        </button>
      </div>

      {/* Vehicle Profile Edit Card */}
      {isEditingVehicle && (
        <form onSubmit={handleSaveVehicle} className="mb-6 p-4 rounded-2xl bg-[#141414] border border-[#d4af37]/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#d4af37] uppercase tracking-wider">Vehicle Profile Specification</h2>
            <span className="text-xs text-gray-400">Complete vehicle setup</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Vehicle Tier</label>
              <select
                id="vehicle-tier-input"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-[#d4af37]"
              >
                <option value="Veloce X">Veloce X</option>
                <option value="Black">Veloce Black</option>
                <option value="Suv">Veloce SUV</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Vehicle Model</label>
              <input
                id="vehicle-model-input"
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="e.g. Mercedes-Benz E-Class"
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-[#d4af37]"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">License Plate</label>
              <input
                id="vehicle-plate-input"
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. DL 01 AB 1234"
                className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-2 text-xs text-white outline-none focus:border-[#d4af37]"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditingVehicle(false)}
              className="px-4 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              id="save-vehicle-btn"
              type="submit"
              disabled={savingVehicle}
              className="px-5 py-1.5 bg-[#d4af37] text-black font-semibold text-xs rounded-xl hover:bg-[#b5952f] transition-all disabled:opacity-50"
            >
              {savingVehicle ? "Saving..." : "Save Vehicle Profile"}
            </button>
          </div>
        </form>
      )}

      {statusMessage && (
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
          {statusMessage}
        </div>
      )}

      {/* Completed Trip Settlement Summary */}
      {completedSummary && (
        <div className="mb-8 bg-[#111] border border-[#d4af37] rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-3xl">
            ✓
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">Journey Settled</span>
            <h2 className="text-2xl font-light text-white mt-1">Trip Completed Successfully</h2>
            <p className="text-xs text-gray-400 mt-1 font-mono">Trip #{completedSummary.id.slice(-8)}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-black/50 border border-white/10 max-w-md mx-auto text-left">
            <div>
              <span className="text-[11px] text-gray-500 uppercase block">Total Trip Fare</span>
              <span className="text-lg font-semibold text-white">₹{Math.round(completedSummary.fareEstimatePaise / 100)}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#d4af37] uppercase block">Your Payout (80%)</span>
              <span className="text-lg font-bold text-[#d4af37]">₹{Math.round((completedSummary.fareEstimatePaise * 0.8) / 100)}</span>
            </div>
          </div>

          {/* Interactive Map of Completed Route with Pins */}
          {completedSummary.pickupLat && completedSummary.dropLat && (
            <div className="h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/10 relative my-4 text-left">
              <Map
                pickup={{ lat: completedSummary.pickupLat, lng: completedSummary.pickupLng! }}
                dropoff={{ lat: completedSummary.dropLat, lng: completedSummary.dropLng! }}
                driverLocation={{ lat: completedSummary.dropLat, lng: completedSummary.dropLng! }}
                routeGeometry={routeGeometry}
              />
              <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur border border-emerald-500/40 px-3 py-1.5 rounded-full text-[11px] text-emerald-400 flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Route Complete • Passenger Dropped Off
              </div>
            </div>
          )}

          <div className="text-xs text-gray-400 max-w-md mx-auto space-y-1">
            <p className="truncate"><span className="text-emerald-400">●</span> {completedSummary.pickupAddress}</p>
            <p className="truncate"><span className="text-[#d4af37]">■</span> {completedSummary.dropAddress}</p>
          </div>
          <button
            onClick={() => setCompletedSummary(null)}
            className="px-8 py-3.5 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b5952f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          >
            Ready for Next Request →
          </button>
        </div>
      )}

      {/* Offline state */}
      {!isOnline ? (
        <div className="flex flex-col items-center justify-center h-64 border border-white/5 rounded-3xl bg-[#111]">
          <span className="text-4xl mb-4">💤</span>
          <p className="text-gray-400 font-light">You are currently offline.</p>
          <p className="text-sm text-gray-600 mt-2">Go online to receive ride requests.</p>
        </div>
      ) : activeRide ? (
        /* Active Ride Management */
        <div className="bg-[#111] border border-[#d4af37] rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div>
              <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">Active Trip</span>
              <h2 className="text-xl font-medium text-white mt-1">Status: {activeRide.status}</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Driver Payout (80%)</div>
              <div className="text-lg font-bold text-[#d4af37]">₹{Math.round((activeRide.fareEstimatePaise * 0.8) / 100)}</div>
            </div>
          </div>

          {/* Interactive Live Map for Driver */}
          <div className="mb-6 h-72 sm:h-80 rounded-2xl overflow-hidden border border-white/10 relative">
            <Map
              pickup={{ lat: activeRide.pickupLat ?? 28.6139, lng: activeRide.pickupLng ?? 77.2090 }}
              dropoff={{ lat: activeRide.dropLat ?? 28.5355, lng: activeRide.dropLng ?? 77.3910 }}
              driverLocation={currentCoords}
              routeGeometry={routeGeometry}
            />
            <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur border border-[#d4af37]/40 px-3 py-1.5 rounded-full text-[11px] text-[#d4af37] flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-ping"></span>
              Live Chauffeur GPS
            </div>
          </div>

          <div className="space-y-4 mb-8 bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="flex items-start gap-3">
              <span className="text-green-400 mt-1">●</span>
              <div>
                <p className="text-xs text-gray-500">Pickup</p>
                <p className="text-sm text-white font-medium">{activeRide.pickupAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#d4af37] mt-1">■</span>
              <div>
                <p className="text-xs text-gray-500">Dropoff</p>
                <p className="text-sm text-white font-medium">{activeRide.dropAddress}</p>
              </div>
            </div>
          </div>

          {/* Lifecycle Action Buttons */}
          <div className="flex gap-4">
            {activeRide.status === "ACCEPTED" && (
              <button
                id="btn-driver-arrived"
                onClick={handleArrived}
                disabled={actionLoading}
                className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-medium hover:bg-[#b08d2c] transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Updating..." : "Arrived at Pickup"}
              </button>
            )}

            {activeRide.status === "ARRIVED" && (
              <button
                id="btn-driver-start"
                onClick={handleStartRide}
                disabled={actionLoading}
                className="w-full bg-blue-500 text-white py-4 rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Starting..." : "Start Ride"}
              </button>
            )}

            {activeRide.status === "IN_PROGRESS" && (
              <button
                id="btn-driver-complete"
                onClick={handleCompleteRide}
                disabled={actionLoading}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Completing..." : "Complete Ride"}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Requests List */
        <div className="space-y-6">
          {/* Chauffeur Radar Map */}
          <div className="h-56 sm:h-64 rounded-2xl overflow-hidden border border-white/10 relative">
            <Map driverLocation={currentCoords} />
            <div className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur border border-emerald-500/40 px-3 py-1.5 rounded-full text-[11px] text-emerald-400 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Chauffeur Radar Active • Ready for Dispatch
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-lg text-white font-light">Available Requests ({requests.length})</h2>
            <span className="text-xs text-gray-500">Real-time matching within 5 km</span>
          </div>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-white/5 rounded-2xl bg-[#111]">
              <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">Searching for nearby riders within 5 km...</p>
            </div>
          ) : (
            requests.map(req => (
              <div 
                key={req.id} 
                id={`ride-request-${req.id}`}
                className="bg-[#111] border border-[#d4af37]/40 hover:border-[#d4af37] transition-all rounded-2xl p-5 flex items-center justify-between"
              >
                <div>
                  <div className="text-white font-medium mb-1 flex items-center gap-2">
                    <span>Ride Request • {(req.distanceMeters / 1000).toFixed(1)} km</span>
                    <span className="text-xs bg-[#d4af37]/20 text-[#d4af37] px-2 py-0.5 rounded">
                      {req.vehicleType}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 max-w-md truncate">
                    {req.pickupAddress} &rarr; {req.dropAddress}
                  </div>
                  <div className="text-[#d4af37] font-semibold mt-2">
                    ₹{(req.fareEstimatePaise / 100).toFixed(0)}
                  </div>
                </div>
                <button 
                  id={`btn-accept-${req.id}`}
                  onClick={() => handleAccept(req.id)} 
                  className="bg-[#d4af37] text-black px-6 py-3 rounded-xl font-medium hover:bg-[#b08d2c] transition-colors"
                >
                  Accept
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
