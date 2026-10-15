import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col xl:flex-row items-center justify-center p-6 gap-8 bg-zinc-950 text-white">
      {/* Demo Credentials Card */}
      <div className="w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
          <h2 className="text-xl font-bold tracking-wide text-zinc-100">Local Demo Credentials</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          Use the pre-configured accounts below to test different roles across Veloce. Password for all demo accounts is pre-configured.
        </p>

        <div className="space-y-4">
          {/* Rider */}
          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-amber-500/50 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Rider Account</span>
              <a
                href="http://localhost:4000/api/demo-login/rider"
                className="text-[11px] px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-sm transition-all flex items-center gap-1"
              >
                ⚡ 1-Click Sign In
              </a>
            </div>
            <div className="text-sm font-mono text-zinc-200 select-all">rider1+clerk_test@example.com</div>
            <div className="text-xs font-mono text-zinc-400 mt-1 flex justify-between">
              <span>Password: <span className="text-zinc-200 select-all font-mono font-medium">VeloceDev#9821$Secure!</span></span>
            </div>
          </div>

          {/* Chauffeur / Driver */}
          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-emerald-500/50 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Driver Account</span>
              <a
                href="http://localhost:4000/api/demo-login/driver"
                className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-sm transition-all flex items-center gap-1"
              >
                ⚡ 1-Click Sign In
              </a>
            </div>
            <div className="text-sm font-mono text-zinc-200 select-all">driver1+clerk_test@example.com</div>
            <div className="text-xs font-mono text-zinc-400 mt-1 flex justify-between">
              <span>Password: <span className="text-zinc-200 select-all font-mono font-medium">VeloceDev#9821$Secure!</span></span>
            </div>
          </div>

          {/* Admin */}
          <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 hover:border-purple-500/50 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Admin Account</span>
              <a
                href="http://localhost:4000/api/demo-login/admin"
                className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500 hover:bg-purple-400 text-white font-semibold shadow-sm transition-all flex items-center gap-1"
              >
                ⚡ 1-Click Sign In
              </a>
            </div>
            <div className="text-sm font-mono text-zinc-200 select-all">test_veloce+clerk_test@example.com</div>
            <div className="text-xs font-mono text-zinc-400 mt-1 flex justify-between">
              <span>Password: <span className="text-zinc-200 select-all font-mono font-medium">VeloceDev#9821$Secure!</span></span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-zinc-800 space-y-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-2 text-amber-300 bg-amber-400/10 p-2.5 rounded-lg border border-amber-400/20">
            <span>🔑</span>
            <span>If manual login asks for an email code / OTP, enter: <strong className="font-mono text-white select-all text-sm">424242</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>Tip: The <strong>⚡ 1-Click Sign In</strong> buttons instantly log you in without any typing!</span>
          </div>
        </div>
      </div>

      {/* Clerk Sign-in box */}
      <Suspense fallback={<div className="text-zinc-400">Loading sign-in...</div>}>
        <SignIn />
      </Suspense>
    </div>
  );
}

export const instant = false;

