// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5174";

export type Kind = "VEHICLE" | "FACILITY" | "EQUIPMENT";
export type BookingStatus = "REQUEST" | "ONGOING" | "SUCCESS" | "CANCEL";

export type Resource = {
  id: number;
  kind: Kind;
  name: string;
  subcategory: string | null;
  type: string | null;
  quantity: number;
  status: string;
};

export type Booking = {
  id: number;
  kind: Kind;
  resource_id: number;
  resource_name: string;
  start_dt: string;
  end_dt: string;
  quantity: number | null;
  status: BookingStatus;
  created_at: string;
};

// Enhanced fetch helper: includes HTTP status + payload on error
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ignore JSON parse errors for non-JSON responses
    }
    const err: any = new Error(
      payload?.message || payload?.error || res.statusText
    );
    err.status = res.status;   // <-- important for 409 conflict handling
    err.payload = payload;
    throw err;
  }

  // If server returns no content (not used here but safe):
  if (res.status === 204) return undefined as unknown as T;

  return (await res.json()) as T;
}

export const api = {
  resources: (kind?: Kind) =>
    http<Resource[]>(kind ? `/api/resources?kind=${kind}` : `/api/resources`),

  bookings: () => http<Booking[]>(`/api/bookings`),

  createBooking: (payload: any) =>
    http<Booking>(`/api/bookings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  start: (id: number) =>
    http<Booking>(`/api/bookings/${id}/start`, { method: "POST" }),

  finish: (id: number) =>
    http<Booking>(`/api/bookings/${id}/finish`, { method: "POST" }),

  cancel: (id: number) =>
    http<Booking>(`/api/bookings/${id}/cancel`, { method: "POST" }),
};
