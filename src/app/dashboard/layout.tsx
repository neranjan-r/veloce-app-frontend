import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-[#f5f5f5]">
      <header className="flex h-20 items-center justify-between border-b border-white/10 premium-glass px-8 sticky top-0 z-50">
        <Link href="/dashboard" className="text-2xl font-light tracking-widest uppercase text-white">
          <span className="premium-text-gradient font-bold">Veloce</span>
        </Link>
        <nav className="flex items-center gap-8">
          <Link href="/dashboard/book" className="text-xs tracking-widest font-medium text-gray-400 uppercase hover:text-[#d4af37] transition-colors">
            Reserve
          </Link>
          <Link href="/dashboard/history" className="text-xs tracking-widest font-medium text-gray-400 uppercase hover:text-[#d4af37] transition-colors">
            Journeys
          </Link>
          <Link href="/dashboard/profile" className="text-xs tracking-widest font-medium text-gray-400 uppercase hover:text-[#d4af37] transition-colors">
            Account
          </Link>
          <div className="pl-4 border-l border-white/10">
            <UserButton />
          </div>
        </nav>
      </header>
      <main className="flex-1 p-8 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">{children}</main>
    </div>
  );
}
