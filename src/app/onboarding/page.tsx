"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const selectRole = async (role: "RIDER" | "DRIVER") => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        throw new Error("Failed to set role");
      }

      // Reload user session to synchronize updated publicMetadata
      await user?.reload();

      if (role === "RIDER") router.push("/dashboard");
      if (role === "DRIVER") router.push("/driver");
    } catch (error) {
      console.error("Failed to update role", error);
      alert("Failed to set account role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-black bg-[url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0"></div>
      
      <div className="z-10 premium-glass p-12 rounded-3xl flex flex-col items-center max-w-3xl w-full mx-4 animate-in fade-in zoom-in duration-500">
        <h1 className="mb-4 text-4xl font-light tracking-wide text-white uppercase">Welcome to <span className="premium-text-gradient font-bold tracking-tighter">Veloce</span></h1>
        <p className="mb-12 text-gray-400 font-light tracking-widest text-sm uppercase">Select your journey</p>
        
        <div className="flex flex-col sm:flex-row gap-8 w-full justify-center">
          <button
            onClick={() => selectRole("RIDER")}
            disabled={loading}
            className="flex h-64 w-full sm:w-64 flex-col items-center justify-center rounded-sm bg-black/40 border border-white/10 transition-all hover:-translate-y-2 hover:border-[#d4af37] hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] disabled:opacity-50 group"
          >
            <span className="mb-6 text-5xl opacity-80 group-hover:opacity-100 transition-opacity">🥂</span>
            <span className="font-semibold tracking-wider text-white uppercase text-sm group-hover:text-[#d4af37] transition-colors">Client</span>
          </button>
          
          <button
            onClick={() => selectRole("DRIVER")}
            disabled={loading}
            className="flex h-64 w-full sm:w-64 flex-col items-center justify-center rounded-sm bg-black/40 border border-white/10 transition-all hover:-translate-y-2 hover:border-[#d4af37] hover:shadow-[0_0_30px_rgba(212,175,55,0.15)] disabled:opacity-50 group"
          >
            <span className="mb-6 text-5xl opacity-80 group-hover:opacity-100 transition-opacity">🕴️</span>
            <span className="font-semibold tracking-wider text-white uppercase text-sm group-hover:text-[#d4af37] transition-colors">Chauffeur</span>
          </button>
        </div>
      </div>
    </div>
  );
}

