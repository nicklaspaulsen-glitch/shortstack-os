"use client";

/**
 * Public reschedule / cancel page.
 *
 * Lands here from the link embedded in confirmation emails. Uses the
 * /api/scheduling/bookings/by-token endpoints — no auth required, the
 * token in the URL is the cap.
 */

import { useEffect, useState, use } from "react";
import { Loader2, Calendar, X, CheckCircle, AlertCircle } from "lucide-react";

interface Booking {
  id: string;
  guest_name: string;
  guest_email: string;
  date: string;
  time: string;
  status: string;
  meeting_type: { name: string; duration: number; location_type: string } | null;
}

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/scheduling/bookings/by-token/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setBooking(data.booking);
      })
      .catch(() => setError("Failed to load booking"))
      .finally(() => setLoading(false));
  }, [token]);

  async function cancelBooking() {
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scheduling/bookings/by-token/${token}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cancel failed");
        return;
      }
      setConfirmation("Your booking has been cancelled.");
      setBooking((b) => (b ? { ...b, status: "cancelled" } : b));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-red-500" />
          <h1 className="text-lg font-bold mb-2">Booking not found</h1>
          <p className="text-sm text-gray-500">
            This link may have expired, been used already, or been mistyped.
          </p>
        </div>
      </div>
    );
  }

  const cancelled = booking.status === "cancelled";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-gray-700" />
          <h1 className="text-lg font-bold text-gray-900">
            {booking.meeting_type?.name || "Your booking"}
          </h1>
        </div>

        <dl className="text-sm text-gray-600 space-y-2 mb-5">
          <div className="flex justify-between">
            <dt>Name</dt>
            <dd className="font-medium text-gray-900">{booking.guest_name}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Date</dt>
            <dd className="font-medium text-gray-900">{booking.date}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Time</dt>
            <dd className="font-medium text-gray-900">{booking.time}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Status</dt>
            <dd
              className={`font-medium ${
                cancelled ? "text-gray-500" : "text-emerald-600"
              }`}
            >
              {cancelled ? "Cancelled" : "Confirmed"}
            </dd>
          </div>
        </dl>

        {confirmation ? (
          <div className="p-3 mb-4 bg-emerald-50 text-emerald-700 text-sm rounded flex items-center gap-2">
            <CheckCircle size={14} /> {confirmation}
          </div>
        ) : null}

        {!cancelled ? (
          <div className="space-y-2">
            <button
              onClick={cancelBooking}
              disabled={busy}
              className="w-full py-2.5 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <X size={14} /> Cancel booking
            </button>
            <p className="text-xs text-gray-400 text-center">
              Need a different time? Cancel and re-book — you can pick any open slot.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
