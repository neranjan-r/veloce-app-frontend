import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[url('https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>
      
      <div className="z-10 text-center premium-glass p-16 rounded-3xl max-w-2xl w-full mx-4 animate-in fade-in zoom-in duration-700">
        <h1 className="text-7xl font-extrabold tracking-tighter mb-4 premium-text-gradient uppercase">
          Veloce
        </h1>
        <p className="text-xl mb-10 text-gray-300 font-light tracking-wide max-w-md mx-auto">
          The pinnacle of private mobility.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-6">
          {userId ? (
            <Link
              href="/dashboard"
              className="px-10 py-4 bg-[#d4af37] text-black rounded-sm font-semibold tracking-wider uppercase hover:bg-[#b5952f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              Enter Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-10 py-4 bg-[#d4af37] text-black rounded-sm font-semibold tracking-wider uppercase hover:bg-[#b5952f] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="px-10 py-4 border border-[#d4af37] text-[#d4af37] rounded-sm font-semibold tracking-wider uppercase hover:bg-[#d4af37]/10 transition-all"
              >
                Become a Member
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export const instant = false;
