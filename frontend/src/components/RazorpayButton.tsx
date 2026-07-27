/**
 * RazorpayButton — Reusable component that opens the Razorpay checkout.
 *
 * Flow:
 *  1. User clicks "Pay with Razorpay"
 *  2. Component calls POST /razorpay/create-order → gets order_id
 *  3. Opens Razorpay checkout popup
 *  4. On success, calls POST /razorpay/verify-payment
 *  5. Calls onSuccess(result) with the verified response
 */

import React, { useState } from "react";
import { CreditCard, RefreshCw, AlertTriangle } from "lucide-react";

// Razorpay is loaded via <script> in index.html — declare global type
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayButtonProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  amount: number;            // Amount in ₹
  vehicleId?: number;        // If provided, FASTag of this vehicle is recharged
  label?: string;            // Button label override
  description?: string;      // Checkout description shown to user
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  onSuccess?: (result: {
    payment_id: string;
    new_fasttag_balance?: number;
    message: string;
  }) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const RazorpayButton: React.FC<RazorpayButtonProps> = ({
  apiFetch,
  amount,
  vehicleId,
  label = "Pay with Razorpay",
  description = "FleetFlow Payment",
  prefillName = "Fleet Admin",
  prefillEmail = "",
  prefillContact = "",
  onSuccess,
  onError,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePay = async () => {
    if (!window.Razorpay) {
      const msg = "Razorpay SDK not loaded. Please check your internet connection.";
      setErrorMsg(msg);
      onError?.(msg);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // ── Step 1: Create Order ─────────────────────────────────────────────
      const orderData = await apiFetch("/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "INR",
          vehicle_id: vehicleId ?? null,
          notes: vehicleId ? { vehicle_id: String(vehicleId), purpose: "fasttag_recharge" } : {},
        }),
      });

      // ── Step 2: Open Razorpay Checkout ───────────────────────────────────
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,       // In paise
        currency: orderData.currency,
        name: "FleetFlow",
        description,
        order_id: orderData.order_id,
        prefill: {
          name: prefillName,
          email: prefillEmail,
          contact: prefillContact,
        },
        theme: {
          color: "#00c2ff",             // Matches FleetFlow accent cyan
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // ── Step 3: Verify Payment ─────────────────────────────────────
          try {
            const verified = await apiFetch("/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                vehicle_id: vehicleId ?? null,
                amount,
              }),
            });

            onSuccess?.({
              payment_id: verified.payment_id,
              new_fasttag_balance: verified.new_fasttag_balance,
              message: verified.message,
            });
          } catch (verifyErr: any) {
            const msg = verifyErr?.message || "Payment verification failed.";
            setErrorMsg(msg);
            onError?.(msg);
          } finally {
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (resp: any) => {
        const msg = resp?.error?.description || "Payment failed. Please try again.";
        setErrorMsg(msg);
        onError?.(msg);
        setLoading(false);
      });

      rzp.open();

    } catch (err: any) {
      const msg = err?.message || "Could not initiate payment. Please try again.";
      setErrorMsg(msg);
      onError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        onClick={handlePay}
        disabled={disabled || loading || amount <= 0}
        className="btn btn-primary"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          height: "40px",
          fontWeight: 700,
          fontSize: "13px",
          background: loading
            ? undefined
            : "linear-gradient(135deg, #528ff5 0%, #00c2ff 100%)",
          opacity: disabled || amount <= 0 ? 0.5 : 1,
          cursor: disabled || loading || amount <= 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <>
            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
            Processing...
          </>
        ) : (
          <>
            <CreditCard size={15} />
            {label} {amount > 0 ? `— ₹${amount.toLocaleString("en-IN")}` : ""}
          </>
        )}
      </button>

      {errorMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "11.5px",
            color: "var(--accent-red)",
            backgroundColor: "rgba(239,68,68,0.06)",
            padding: "7px 10px",
            borderRadius: "6px",
            border: "1px solid rgba(239,68,68,0.15)",
          }}
        >
          <AlertTriangle size={12} />
          {errorMsg}
        </div>
      )}
    </div>
  );
};
