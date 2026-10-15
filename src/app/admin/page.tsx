"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";
import { useUser, useAuth } from "@clerk/nextjs";
import { io, Socket } from "socket.io-client";

interface AdminStats {
  totalRides: number;
  completedRides: number;
  activeDrivers: number;
  openTickets: number;
  activeSos: number;
  totalRevenuePaise: number;
  totalRevenueRupees: number;
}

interface AdminRide {
  id: string;
  status: string;
  vehicleType: string;
  pickupAddress: string;
  dropAddress: string;
  fareEstimatePaise: number;
  fareFinalPaise?: number | null;
  cancellationFeePaise?: number | null;
  createdAt: string;
}

interface SosEvent {
  id: string;
  rideId: string;
  userId: string;
  lat: number;
  lng: number;
  resolved: boolean;
  trackingUrl?: string;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  userId: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string | null;
  createdAt: string;
}

interface PromoCode {
  id: string;
  code: string;
  percentOff?: number | null;
  flatOffPaise?: number | null;
  maxUses: number;
  usedCount: number;
  active: boolean;
}

export default function AdminDashboardPage() {
  const { fetchApi } = useApi();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const userRole = (user?.publicMetadata?.role as string | undefined)?.toLowerCase();
  const isAdmin = userRole === "admin";
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [liveAlert, setLiveAlert] = useState<{ rideId: string; trackingUrl?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<"overview" | "sos" | "rides" | "tickets" | "promos">("overview");
  const [loading, setLoading] = useState(false);
  const [replyInput, setReplyInput] = useState<{ [ticketId: string]: string }>({});
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);

  // New promo form state
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoType, setNewPromoType] = useState<"PERCENT" | "FLAT">("PERCENT");
  const [newPromoValue, setNewPromoValue] = useState("15");
  const [newPromoMaxUses, setNewPromoMaxUses] = useState("100");
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Helper fetch for admin endpoints
  const fetchAdmin = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    return fetchApi(endpoint, options);
  }, [fetchApi]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, ridesRes, sosRes, ticketsRes, promosRes] = await Promise.all([
        fetchAdmin("/api/admin/stats"),
        fetchAdmin("/api/admin/rides"),
        fetchAdmin("/api/admin/sos"),
        fetchAdmin("/api/admin/tickets"),
        fetchAdmin("/api/admin/promos")
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (ridesRes.data?.rides) setRides(ridesRes.data.rides);
      if (sosRes.data) setSosEvents(sosRes.data);
      if (ticketsRes.data) setTickets(ticketsRes.data);
      if (promosRes.data) setPromos(promosRes.data);
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchAdmin]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);

    let s: Socket | null = null;
    const connectSocket = async () => {
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        s = io(apiUrl, {
          auth: { token },
          reconnection: true
        });

        s.on("connect", () => {
          console.log("[Admin Socket] Connected and joined admins room");
        });

        s.on("sos:alert", (data: { rideId: string; sosEvent: SosEvent; trackingUrl?: string }) => {
          console.log("[Admin Socket] LIVE ALERT RECEIVED:", data);
          if (data.sosEvent) {
            const eventWithUrl = { ...data.sosEvent, trackingUrl: data.trackingUrl };
            setSosEvents(prev => [eventWithUrl, ...prev.filter(e => e.id !== data.sosEvent.id)]);
            setStats(prev => prev ? { ...prev, activeSos: prev.activeSos + 1 } : prev);
            setLiveAlert({ rideId: data.rideId, trackingUrl: data.trackingUrl });
          }
        });
      } catch (err) {
        console.error("[Admin Socket] Connection error:", err);
      }
    };

    connectSocket();

    return () => {
      clearInterval(interval);
      s?.disconnect();
    };
  }, [loadData, getToken]);

  const handleResolveSos = async (sosId: string) => {
    try {
      await fetchAdmin(`/api/admin/sos/${sosId}/resolve`, { method: "POST" });
      setSosEvents(prev => prev.map(s => s.id === sosId ? { ...s, resolved: true } : s));
      loadData();
    } catch (err) {
      console.error("Resolve SOS error:", err);
      alert("Failed to resolve emergency.");
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    const reply = replyInput[ticketId]?.trim();
    if (!reply) return;
    setResolvingTicketId(ticketId);
    try {
      const res = await fetchAdmin(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        body: JSON.stringify({ adminReply: reply, status: "RESOLVED" })
      });
      if (res.data) {
        setTickets(prev => prev.map(t => t.id === ticketId ? res.data : t));
        setReplyInput(prev => ({ ...prev, [ticketId]: "" }));
      }
    } catch (err) {
      console.error("Ticket reply error:", err);
      alert("Failed to send ticket reply.");
    } finally {
      setResolvingTicketId(null);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoCode) return;
    setCreatingPromo(true);
    try {
      const payload: {
        code: string;
        maxUses: number;
        percentOff?: number;
        flatOffPaise?: number;
      } = {
        code: newPromoCode.trim().toUpperCase(),
        maxUses: parseInt(newPromoMaxUses, 10) || 100
      };
      if (newPromoType === "PERCENT") {
        payload.percentOff = parseInt(newPromoValue, 10);
      } else {
        payload.flatOffPaise = parseInt(newPromoValue, 10) * 100; // Rs to paise
      }

      const res = await fetchAdmin("/api/admin/promos", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res.data) {
        setPromos(prev => [res.data, ...prev]);
        setNewPromoCode("");
      }
    } catch (err) {
      console.error("Create promo error:", err);
      alert("Failed to create promotional code.");
    } finally {
      setCreatingPromo(false);
    }
  };

  const unresolvedSosList = sosEvents.filter(s => !s.resolved);

  if (isLoaded && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl text-red-400 mb-4">
          ✕
        </div>
        <h1 className="text-2xl font-light text-white mb-2">Access Refused</h1>
        <p className="text-xs text-gray-400 max-w-md mb-6">
          Administrative privileges required. Your account lacks public metadata role: &quot;admin&quot;.
        </p>
        <Link
          href="/dashboard"
          className="px-6 py-2.5 bg-[#d4af37] text-black font-semibold text-xs rounded-xl hover:bg-[#b08d2c] transition-colors"
        >
          Return to Passenger Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-4 sm:p-8 pb-16">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-white/10 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl font-light tracking-widest text-[#d4af37]">VELOCE</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 uppercase tracking-widest">
                EXECUTIVE ADMIN
              </span>
            </div>
            <h1 className="text-2xl font-light text-white mt-1">Platform Operations Command</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">
              Passenger View
            </Link>
            <Link href="/driver" className="text-xs text-gray-400 hover:text-white transition-colors">
              Chauffeur View
            </Link>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-xs rounded-xl transition-colors flex items-center gap-2"
            >
              <span>↻</span> Refresh Operations
            </button>
          </div>
        </div>

        {/* Live SOS Incoming Notification */}
        {liveAlert && (
          <div className="p-6 rounded-3xl bg-red-600 border-2 border-white text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl animate-pulse">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🚨</span>
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-white">
                  LIVE DISTRESS SIGNAL RECEIVED
                </h3>
                <p className="text-xs text-white/90">
                  Ride #{liveAlert.rideId} activated emergency beacon. Incident streamed in real-time.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {liveAlert.trackingUrl && (
                <Link
                  href={liveAlert.trackingUrl}
                  target="_blank"
                  className="px-5 py-2.5 bg-white text-red-700 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
                >
                  Open Live Tracking
                </Link>
              )}
              <button
                onClick={() => { setActiveTab("sos"); setLiveAlert(null); }}
                className="px-4 py-2 bg-black/40 hover:bg-black/60 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                View SOS Tab
              </button>
            </div>
          </div>
        )}

        {/* SOS Emergency Priority Alert Banner */}
        {unresolvedSosList.length > 0 && (
          <div className="p-6 rounded-3xl bg-red-950/40 border-2 border-red-500 text-white space-y-4 shadow-2xl animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <div>
                  <h2 className="text-lg font-bold text-red-400 uppercase tracking-wider">
                    {unresolvedSosList.length} ACTIVE EMERGENCY BEACON(S)
                  </h2>
                  <p className="text-xs text-red-200">
                    Immediate safety protocol alert triggered by passenger/driver.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("sos")}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors"
              >
                Inspect Emergencies
              </button>
            </div>
          </div>
        )}

        {/* KPI Metrics */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Gross Revenue</span>
              <p className="text-2xl font-bold text-[#d4af37]">₹{stats.totalRevenueRupees.toLocaleString("en-IN")}</p>
              <span className="text-[10px] text-gray-500 block">{stats.completedRides} settled journeys</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Total Rides</span>
              <p className="text-2xl font-bold text-white">{stats.totalRides}</p>
              <span className="text-[10px] text-emerald-400 block">{stats.completedRides} Completed</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Active Chauffeurs</span>
              <p className="text-2xl font-bold text-white">{stats.activeDrivers}</p>
              <span className="text-[10px] text-emerald-400 block">Online & GPS Active</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Support Inquiries</span>
              <p className="text-2xl font-bold text-white">{stats.openTickets}</p>
              <span className="text-[10px] text-amber-400 block">Requiring Resolution</span>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">SOS Emergencies</span>
              <p className={`text-2xl font-bold ${stats.activeSos > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {stats.activeSos}
              </p>
              <span className="text-[10px] text-gray-500 block">Unresolved Beacons</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 gap-2 sm:gap-4 overflow-x-auto">
          {[
            { key: "overview", label: "Operations Overview" },
            { key: "sos", label: `Emergency Radar (${unresolvedSosList.length})` },
            { key: "rides", label: "Dispatch Log" },
            { key: "tickets", label: `Support Desk (${tickets.filter(t => t.status === "OPEN").length})` },
            { key: "promos", label: "Marketing Promos" }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "overview" | "sos" | "rides" | "tickets" | "promos")}
              className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap px-2 ${
                activeTab === tab.key
                  ? "border-[#d4af37] text-[#d4af37]"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: Overview & Recent Dispatches */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Recent Dispatches</h3>
                  <button onClick={() => setActiveTab("rides")} className="text-xs text-[#d4af37] hover:underline">
                    View All &rarr;
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500">
                        <th className="pb-3">Ride ID</th>
                        <th className="pb-3">Vehicle</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Pickup &rarr; Destination</th>
                        <th className="pb-3 text-right">Fare</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rides.slice(0, 6).map((r) => (
                        <tr key={r.id} className="hover:bg-white/5">
                          <td className="py-3 font-mono text-gray-400">{r.id.slice(-6)}</td>
                          <td className="py-3 font-medium text-white">{r.vehicleType}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 text-gray-300 truncate max-w-[200px]">
                            {r.pickupAddress} &rarr; {r.dropAddress}
                          </td>
                          <td className="py-3 text-right font-semibold text-[#d4af37]">
                            ₹{Math.round((r.fareFinalPaise || r.fareEstimatePaise) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Actions & Support Inquiries */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Open Inquiries</h3>
                {tickets.filter(t => t.status === "OPEN").length === 0 ? (
                  <p className="text-xs text-gray-500 py-4">No open support tickets. All inquiries resolved.</p>
                ) : (
                  <div className="space-y-3">
                    {tickets.filter(t => t.status === "OPEN").slice(0, 3).map((t) => (
                      <div key={t.id} className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#d4af37]">{t.category}</span>
                          <span className="text-gray-500 font-mono">{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-white line-clamp-2">{t.message}</p>
                      </div>
                    ))}
                    <button
                      onClick={() => setActiveTab("tickets")}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-xl transition-colors"
                    >
                      Open Support Desk
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: SOS Emergencies */}
        {activeTab === "sos" && (
          <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Emergency Beacon Monitor</h3>
                <p className="text-xs text-gray-400">Live coordinates and real-time safety distress incidents.</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40">
                {unresolvedSosList.length} Active Incidents
              </span>
            </div>

            {sosEvents.length === 0 ? (
              <p className="text-xs text-gray-500 py-8 text-center">No SOS distress signals logged.</p>
            ) : (
              <div className="space-y-4">
                {sosEvents.map((sos) => (
                  <div
                    key={sos.id}
                    className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      sos.resolved
                        ? "bg-white/5 border-white/10 text-gray-400"
                        : "bg-red-500/15 border-red-500 text-white"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{sos.resolved ? "✓" : "🚨"}</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                          {sos.resolved ? "Resolved Incident" : "ACTIVE DISTRESS BEACON"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          {new Date(sos.createdAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs font-mono">
                        Ride ID: <strong className="text-white">{sos.rideId}</strong> • User: {sos.userId}
                      </p>
                      <p className="text-xs text-gray-300">
                        GPS Coordinates: <strong className="text-[#d4af37] font-mono">{sos.lat.toFixed(5)}, {sos.lng.toFixed(5)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/ride/${sos.rideId}`}
                        target="_blank"
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-xl transition-colors"
                      >
                        Inspect Ride
                      </Link>
                      {!sos.resolved && (
                        <button
                          onClick={() => handleResolveSos(sos.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition-colors"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: All Rides */}
        {activeTab === "rides" && (
          <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-6">
            <h3 className="text-base font-semibold text-white">All Platform Dispatches</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500">
                    <th className="pb-3">Ride ID</th>
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Vehicle</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Fee Notes</th>
                    <th className="pb-3 text-right">Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rides.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="py-3 font-mono text-gray-400">{r.id.slice(-8)}</td>
                      <td className="py-3 text-gray-400">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 font-medium text-white">{r.vehicleType}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-white">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300 truncate max-w-[220px]">
                        {r.pickupAddress} &rarr; {r.dropAddress}
                      </td>
                      <td className="py-3 text-[11px] text-gray-400">
                        {r.cancellationFeePaise ? `₹${r.cancellationFeePaise / 100} Cancel Fee` : "-"}
                      </td>
                      <td className="py-3 text-right font-semibold text-[#d4af37]">
                        ₹{Math.round((r.fareFinalPaise || r.fareEstimatePaise) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Support Desk */}
        {activeTab === "tickets" && (
          <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-6">
            <h3 className="text-base font-semibold text-white">Customer Support Inquiry Ledger</h3>
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#d4af37]/20 text-[#d4af37]">
                        {t.category}
                      </span>
                      <span className="text-xs font-mono text-gray-400">User: {t.userId}</span>
                      <span className="text-[10px] text-gray-500">{new Date(t.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      t.status === "RESOLVED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  <p className="text-xs text-white">{t.message}</p>

                  {t.adminReply ? (
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-emerald-400 space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 block font-semibold">Executive Reply Sent:</span>
                      <p>{t.adminReply}</p>
                    </div>
                  ) : (
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyInput[t.id] || ""}
                        onChange={(e) => setReplyInput(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Type resolution reply to customer..."
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#d4af37]"
                      />
                      <button
                        onClick={() => handleReplyTicket(t.id)}
                        disabled={resolvingTicketId === t.id}
                        className="px-4 py-2 bg-[#d4af37] text-black font-semibold text-xs rounded-xl hover:bg-[#b08d2c] transition-colors"
                      >
                        {resolvingTicketId === t.id ? "Sending..." : "Resolve"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Marketing Promos */}
        {activeTab === "promos" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-6">
              <h3 className="text-base font-semibold text-white">Active Promotional Codes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {promos.map((p) => (
                  <div key={p.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-bold text-[#d4af37] tracking-wider">{p.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-white">
                      {p.percentOff ? `${p.percentOff}% Off` : `₹${(p.flatOffPaise || 0) / 100} Flat Off`}
                    </p>
                    <div className="pt-1 text-[10px] text-gray-400 flex items-center justify-between">
                      <span>Redemptions:</span>
                      <strong className="text-white font-mono">{p.usedCount} / {p.maxUses}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Promo Code */}
            <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Create New Promo</h3>
              <form onSubmit={handleCreatePromo} className="space-y-4 text-xs">
                <div>
                  <label className="text-gray-400 block mb-1">Code Name</label>
                  <input
                    type="text"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                    placeholder="E.g. VIP25"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-2.5 text-white uppercase outline-none focus:border-[#d4af37]"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-gray-400 block mb-1">Type</label>
                    <select
                      value={newPromoType}
                      onChange={(e) => setNewPromoType(e.target.value as "PERCENT" | "FLAT")}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#d4af37]"
                    >
                      <option value="PERCENT">Percent (%)</option>
                      <option value="FLAT">Flat (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 block mb-1">Discount Value</label>
                    <input
                      type="number"
                      value={newPromoValue}
                      onChange={(e) => setNewPromoValue(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#d4af37]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1">Max Redemptions</label>
                  <input
                    type="number"
                    value={newPromoMaxUses}
                    onChange={(e) => setNewPromoMaxUses(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#d4af37]"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingPromo}
                  className="w-full py-3 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors"
                >
                  {creatingPromo ? "Creating..." : "Create Promo Code"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
