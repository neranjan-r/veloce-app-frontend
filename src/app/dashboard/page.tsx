
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ActiveRideBanner from "@/components/ActiveRideBanner";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId) {
    redirect("/sign-in");
  }

  // Use user's publicMetadata strictly
  const role = (user?.publicMetadata?.role as string | undefined)?.toUpperCase();
  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "RIDER") {
    redirect(role === "DRIVER" ? "/driver" : "/admin");
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <ActiveRideBanner />

      <div className="mb-12 border-b border-white/10 pb-6">
        <h1 className="text-4xl font-light tracking-wide text-white uppercase">Welcome, <span className="premium-text-gradient font-medium">{user?.firstName || "Client"}</span></h1>
        <p className="text-gray-400 mt-2 font-light tracking-widest text-sm uppercase">Your exceptional journey awaits</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Link 
          href="/dashboard/book"
          className="group relative flex h-64 flex-col items-center justify-center overflow-hidden rounded-sm premium-glass border border-[#d4af37]/30 hover:border-[#d4af37] transition-all duration-500 hover:shadow-[0_0_40px_rgba(212,175,55,0.15)]"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
          <img src="https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80" alt="Luxury Car" className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700 z-0" />
          <div className="z-20 text-center">
            <span className="mb-4 block text-4xl text-[#d4af37] drop-shadow-md">✧</span>
            <span className="text-xl font-light tracking-widest uppercase text-white group-hover:text-[#d4af37] transition-colors">Reserve a Vehicle</span>
          </div>
        </Link>

        <div className="rounded-sm premium-glass border border-white/10 p-8 flex flex-col justify-between hover:border-white/20 transition-colors">
          <div>
            <h2 className="mb-6 text-sm font-semibold tracking-widest text-gray-400 uppercase">Recent Itineraries</h2>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-3xl mb-4 opacity-20">⌚</span>
              <p className="text-gray-500 font-light tracking-wide text-sm">No recent journeys found.</p>
            </div>
          </div>
          <Link href="/dashboard/history" className="text-xs text-[#d4af37] hover:text-white uppercase tracking-widest transition-colors mt-auto text-center border-t border-white/10 pt-4">
            View All History
          </Link>
        </div>
      </div>
    </div>
  );
}

export const instant = false;
