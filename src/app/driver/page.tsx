"use client";

import { useState, useEffect, useCallback } from "react";
import { useApi } from "@/lib/api";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@clerk/nextjs";

interface DriverRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  fareEstimatePaise: number;
  distanceMeters: number;
  vehicleType: string;
}

export default function DriverDashboard() {
  const [isOnline, setIsOnline] = useState(false);
  const [requests, setRequests] = useState<DriverRide[]>([]);
  const [activeRide, setActiveRide] = useState<DriverRide | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const { fetchApi } = useApi();
  const { getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  // Dev-only coordinates override
  const isDev = process.env.NODE_ENV !== "production";
  const devLatStr = process.env.NEXT_PUBLIC_DEV_DRIVER_LAT;
  const devLngStr = process.env.NEXT_PUBLIC_DEV_DRIVER_LNG;
  const devLat = devLatStr ? parseFloat(devLatStr) : null;
  const devLng = devLngStr ? parseFloat(devLngStr) : null;
  const hasDevOverride = isDev && devLat !== null && !isNaN(devLat) && devLng !== null && !isNaN(devLng);

  const getCoordinates = useCallback(async (): Promise<{ lat: number; lng: number }> => {
    if (hasDevOverride) {
      console.log(`[Dev Override Active] Driver coordinates: (${devLat}, ${devLng})`);
      return { lat: devLat!, lng: devLng! };
    }
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve({ lat: 28.6315, lng: 77.2167 })
        );
      } else {
        resolve({ lat: 28.6315, lng: 77.2167 });
      }
    });
  }, [hasDevOverride, devLat, devLng]);

  useEffect(() => {
    let s: Socket | null = null;
    let watchId: number | null = null;

    const init = async () => {
      if (!isOnline) return;

      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      s = io(apiUrl, {
        query: {
          role: "DRIVER",
          vehicleType: "Veloce X",
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

      setSocket(s);

      // Fetch pending requests immediately
      try {
        const res = await fetchApi("/api/driver/requests");
        setRequests(res.data || []);
      } catch (e: unknown) {
        console.error("Error loading requests:", e);
      }

      // Handle location updates
      if (hasDevOverride) {
        fetchApi("/api/driver/location", {
          method: "POST",
          body: JSON.stringify({ lat: devLat, lng: devLng })
        }).catch(console.error);
      } else if (navigator.geolocation) {
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
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (s) {
        s.disconnect();
      }
    };
  }, [isOnline, fetchApi, getToken, hasDevOverride, devLat, devLng]);

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
    try {
      const res = await fetchApi(`/api/rides/${activeRide.id}/arrived`, { method: "POST" });
      setActiveRide(res.data);
      setStatusMessage("You have arrived at pickup location.");
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    try {
      const res = await fetchApi(`/api/rides/${activeRide.id}/start`, { method: "POST" });
      setActiveRide(res.data);
      setStatusMessage("Ride is currently in progress.");
    } catch (e: unknown) {
      console.error(e);
    }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    try {
      await fetchApi(`/api/rides/${activeRide.id}/complete`, { method: "POST" });
      setActiveRide(null);
      setStatusMessage("Ride completed! Ready for next request.");
    } catch (e: unknown) {
      console.error(e);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 bg-[#0a0a0a] min-h-screen text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-light text-white">Veloce <span className="text-[#d4af37]">Driver</span></h1>
          <p className="text-xs text-gray-400 mt-1">
            Vehicle: <span className="text-white font-medium">Veloce X</span>
            {hasDevOverride && (
              <span className="ml-3 text-[#d4af37] bg-[#d4af37]/10 px-2 py-0.5 rounded border border-[#d4af37]/30">
                Dev Override: Connaught Place ({devLat}, {devLng})
              </span>
            )}
          </p>
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

      {statusMessage && (
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
          {statusMessage}
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
              <div className="text-sm text-gray-400">Fare</div>
              <div className="text-lg font-bold text-[#d4af37]">₹{(activeRide.fareEstimatePaise / 100).toFixed(0)}</div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
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
                className="w-full bg-[#d4af37] text-black py-4 rounded-xl font-medium hover:bg-[#b08d2c] transition-colors"
              >
                Arrived at Pickup
              </button>
            )}

            {activeRide.status === "ARRIVED" && (
              <button
                id="btn-driver-start"
                onClick={handleStartRide}
                className="w-full bg-blue-500 text-white py-4 rounded-xl font-medium hover:bg-blue-600 transition-colors"
              >
                Start Ride
              </button>
            )}

            {activeRide.status === "IN_PROGRESS" && (
              <button
                id="btn-driver-complete"
                onClick={handleCompleteRide}
                className="w-full bg-green-500 text-white py-4 rounded-xl font-medium hover:bg-green-600 transition-colors"
              >
                Complete Ride
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Requests List */
        <div className="space-y-6">
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
