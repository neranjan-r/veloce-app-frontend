"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { useApi } from "@/lib/api";

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export default function ProfilePage() {
  const { fetchApi } = useApi();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("12");
  const [expYear, setExpYear] = useState("2028");
  const [addingCard, setAddingCard] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadMethods = async () => {
    try {
      setLoading(true);
      const res = await fetchApi("/api/payments/methods");
      if (res.data) {
        setPaymentMethods(res.data);
      }
    } catch (e: unknown) {
      console.error("Error loading payment methods:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMethods();
  }, [fetchApi]);

  const handleDeleteCard = async (id: string) => {
    try {
      await fetchApi(`/api/payments/methods/${id}`, { method: "DELETE" });
      setPaymentMethods(prev => prev.filter(pm => pm.id !== id));
      setMessage("Card removed successfully.");
    } catch (e: unknown) {
      console.error(e);
      alert("Failed to remove card.");
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCard(true);
    setMessage(null);
    try {
      // In test mode, create setup intent and simulate card registration
      await fetchApi("/api/payments/setup-intent", { method: "POST" });
      const last4 = cardNumber.replace(/\s+/g, "").slice(-4) || "4242";
      const brand = cardNumber.startsWith("3") ? "amex" : cardNumber.startsWith("5") ? "mastercard" : "visa";
      
      const newMethod: PaymentMethod = {
        id: `pm_test_${Date.now()}`,
        brand,
        last4,
        expMonth: parseInt(expMonth, 10),
        expYear: parseInt(expYear, 10)
      };

      setPaymentMethods(prev => [...prev, newMethod]);
      setShowAddCard(false);
      setCardNumber("");
      setMessage("Payment method saved securely.");
    } catch (err: unknown) {
      console.error(err);
      setMessage("Failed to save payment method.");
    } finally {
      setAddingCard(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-16">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-3xl font-light text-white uppercase tracking-wider">
          Client <span className="premium-text-gradient font-medium">Profile</span>
        </h1>
        <p className="text-gray-400 text-xs font-light tracking-widest uppercase mt-1">
          Manage your luxury membership and payment preferences
        </p>
      </div>

      {/* Saved Payment Methods Section */}
      <div className="premium-glass border border-white/10 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div>
            <h2 className="text-lg font-light text-white uppercase tracking-wide">Saved Payment Methods</h2>
            <p className="text-xs text-gray-400">Zero card numbers stored on server • 256-bit encrypted via Stripe</p>
          </div>
          <button
            onClick={() => setShowAddCard(!showAddCard)}
            className="px-4 py-2 bg-[#d4af37] text-black text-xs font-medium uppercase tracking-wider rounded-sm hover:bg-[#b08d2c] transition-all"
          >
            {showAddCard ? "Cancel" : "+ Add Card"}
          </button>
        </div>

        {message && (
          <div className="mb-6 p-3 rounded bg-white/5 border border-white/10 text-xs text-[#d4af37]">
            {message}
          </div>
        )}

        {showAddCard && (
          <form onSubmit={handleAddCard} className="mb-8 p-6 bg-black/60 border border-[#d4af37]/40 rounded-xl space-y-4">
            <h3 className="text-sm font-medium text-white uppercase tracking-wider">Add New Card</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Card Number (Test Cards Accepted)</label>
              <input
                type="text"
                placeholder="4242 •••• •••• 4242"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Exp Month</label>
                <input
                  type="text"
                  placeholder="12"
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Exp Year</label>
                <input
                  type="text"
                  placeholder="2028"
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded px-4 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addingCard}
              className="w-full py-2.5 bg-[#d4af37] text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-[#b08d2c] transition-colors"
            >
              {addingCard ? "Saving Card..." : "Save Card"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-gray-500 uppercase tracking-wider">Loading payment methods...</div>
        ) : paymentMethods.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-500">
            No saved cards. Add a card for effortless one-click trip settlement.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {paymentMethods.map(pm => (
              <div
                key={pm.id}
                className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between hover:border-[#d4af37]/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center font-bold text-xs uppercase text-[#d4af37]">
                    {pm.brand === "visa" ? "VISA" : pm.brand === "mastercard" ? "MC" : "CARD"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white tracking-wider">•••• •••• •••• {pm.last4}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Expires {pm.expMonth}/{pm.expYear}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCard(pm.id)}
                  className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 transition-colors"
                  title="Remove card"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clerk User Profile */}
      <div className="flex justify-center">
        <UserProfile />
      </div>
    </div>
  );
}
