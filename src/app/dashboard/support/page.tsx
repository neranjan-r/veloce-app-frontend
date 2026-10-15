"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/api";

interface SupportTicket {
  id: string;
  category: string;
  message: string;
  status: string;
  adminReply?: string | null;
  createdAt: string;
}

export default function SupportPage() {
  const { fetchApi } = useApi();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Journey Issue");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetchApi("/api/support/tickets");
      if (res.data) setTickets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    try {
      const res = await fetchApi("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ category, message: message.trim() })
      });
      if (res.data) {
        setTickets(prev => [res.data, ...prev]);
        setMessage("");
        setSuccessMsg("Your inquiry has been submitted. Our executive support team will respond shortly.");
      }
    } catch (err: unknown) {
      alert((err as Error).message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold">Concierge Assistance</span>
          <h1 className="text-2xl font-light text-white mt-1">24/7 Dedicated Support</h1>
        </div>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">
          &larr; Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ticket Submission Form */}
        <div className="md:col-span-1 p-6 bg-[#141414] border border-white/10 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Submit New Inquiry</h3>
          
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-gray-400 block mb-1">Issue Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-[#d4af37]"
              >
                <option value="Journey Issue">Journey Issue</option>
                <option value="Payment & Billing">Payment & Billing</option>
                <option value="Chauffeur Feedback">Chauffeur Feedback</option>
                <option value="Lost Property">Lost Property</option>
                <option value="Account & Security">Account & Security</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Detailed Explanation</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your inquiry or assistance request..."
                rows={4}
                className="w-full bg-[#1c1c1c] border border-white/10 rounded-xl p-3 text-white outline-none focus:border-[#d4af37]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-[#b08d2c] transition-colors"
            >
              {submitting ? "Submitting..." : "Submit Inquiry"}
            </button>
          </form>
        </div>

        {/* Previous Inquiries */}
        <div className="md:col-span-2 p-6 bg-[#141414] border border-white/10 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Previous Inquiries & Responses</h3>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500 text-xs">Loading inquiries...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-xs">No support tickets found.</div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#d4af37]">{t.category}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      t.status === "RESOLVED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-white">{t.message}</p>
                  <span className="text-[10px] text-gray-500 block">
                    Logged on {new Date(t.createdAt).toLocaleDateString("en-IN")}
                  </span>

                  {t.adminReply && (
                    <div className="mt-2 p-3 bg-black/50 border border-[#d4af37]/30 rounded-xl space-y-1">
                      <span className="text-[10px] text-[#d4af37] font-semibold block uppercase">Executive Concierge Response:</span>
                      <p className="text-gray-300">{t.adminReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
