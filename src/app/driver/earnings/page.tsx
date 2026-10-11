"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";

interface TripEarning {
  id: string;
  createdAt: string;
  pickupAddress: string;
  dropAddress: string;
  fareFinalPaise: number;
  driverPayoutPaise: number;
  status: string;
}

interface EarningsData {
  totalEarningsPaise: number;
  pendingPayoutsPaise: number;
  payoutsEnabled: boolean;
  totalTrips: number;
  rides: TripEarning[];
}

export default function DriverEarningsPage() {
  const { fetchApi } = useApi();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    async function loadEarnings() {
      try {
        setLoading(true);
        const res = await fetchApi("/api/driver/earnings");
        if (res.data) {
          setData(res.data);
        }
      } catch (e: unknown) {
        console.error("Error loading earnings:", e);
      } finally {
        setLoading(false);
      }
    }

    loadEarnings();
  }, [fetchApi]);

  const handleConnectStripe = async () => {
    setOnboarding(true);
    try {
      const res = await fetchApi("/api/driver/payouts/onboard", { method: "POST" });
      if (res.data?.onboardingUrl) {
        window.location.href = res.data.onboardingUrl;
      }
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to initiate Stripe onboarding.");
      setOnboarding(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 min-h-screen text-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 text-xs uppercase tracking-widest">Loading earnings ledger...</p>
      </div>
    );
  }

  const totalRupees = Math.round((data?.totalEarningsPaise || 0) / 100);
  const pendingRupees = Math.round((data?.pendingPayoutsPaise || 0) / 100);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 bg-[#0a0a0a] min-h-screen text-white pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-white/10 mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-light text-white">Veloce <span className="text-[#d4af37]">Earnings Ledger</span></h1>
          <p className="text-xs text-gray-400 mt-1">Earnings ledger (payouts are simulated in this version) • 80% Driver Revenue Allocation</p>
        </div>
        <Link
          href="/driver"
          className="text-xs text-gray-400 hover:text-white transition-colors self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] rounded-md px-1"
        >
          &larr; Driver Console
        </Link>
      </div>

      {/* Internal Ledger Notice */}
      <div className="mb-8 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-semibold">Simulation Ledger</span>
          <h3 className="text-base font-medium text-white mt-0.5">
            Internal Settlement Simulator
          </h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md">
            Earnings ledger (payouts are simulated in this version). Direct bank transfers are not processed in this demo.
          </p>
        </div>
        <span className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 text-xs font-mono rounded-xl whitespace-nowrap self-start sm:self-auto">
          Demo Ledger Mode
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="p-6 rounded-2xl bg-[#111] border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Net Earnings</p>
          <h2 className="text-3xl font-bold text-[#d4af37] mt-2">₹{totalRupees}</h2>
          <p className="text-[11px] text-gray-500 mt-1">Platform fee 20% deducted</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#111] border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Pending Payout</p>
          <h2 className="text-3xl font-bold text-white mt-2">₹{pendingRupees}</h2>
          <p className="text-[11px] text-gray-500 mt-1">{data?.payoutsEnabled ? "Settled daily" : "Pending account setup"}</p>
        </div>

        <div className="p-6 rounded-2xl bg-[#111] border border-white/10">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Completed Trips</p>
          <h2 className="text-3xl font-bold text-white mt-2">{data?.totalTrips || 0}</h2>
          <p className="text-[11px] text-gray-500 mt-1">Lifetime completed rides</p>
        </div>
      </div>

      {/* Per-trip Earnings Ledger */}
      <div>
        <h2 className="text-base font-light text-white uppercase tracking-wider mb-4">Journey Ledger</h2>
        {(!data?.rides || data.rides.length === 0) ? (
          <div className="py-12 border border-white/5 rounded-2xl bg-[#111] text-center text-xs text-gray-500">
            No completed journeys recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {data.rides.map((ride) => (
              <div
                key={ride.id}
                className="p-5 rounded-xl border border-white/10 bg-[#111] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[#d4af37] font-semibold">Ride #{ride.id.slice(-6)}</span>
                    <span className="text-[10px] text-gray-500">• {new Date(ride.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-xs text-gray-300 max-w-lg truncate">
                    {ride.pickupAddress} &rarr; {ride.dropAddress}
                  </p>
                </div>
                <div className="text-right flex sm:flex-col justify-between items-center sm:items-end">
                  <span className="text-sm font-bold text-emerald-400">
                    +₹{Math.round(ride.driverPayoutPaise / 100)}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Total Fare: ₹{Math.round(ride.fareFinalPaise / 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
