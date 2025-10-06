// src/lib/api.ts

// ---------- Types ----------
export type ResourceKind = 'VEHICLE' | 'FACILITY' | 'EQUIPMENT';
export type ResourceStatus = 'Available' | 'Maintenance' | 'Inactive';

export interface Resource {
  id: number;
  kind: ResourceKind;
  name: string;
  subcategory?: string | null;
  type?: string | null;
  quantity: number;
  status: ResourceStatus;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus = 'REQUEST' | 'ONGOING' | 'SUCCESS' | 'CANCEL';

export interface Booking {
  id: number;
  kind: ResourceKind;
  resource_id: number;
  resource_name: string;
  start_dt: string; // ISO
  end_dt: string;   // ISO
  quantity?: number | null;
  status: BookingStatus;
  requester_name?: string | null;
  requester_role?: string | null;
  purpose?: string | null;
  created_at: string;
  updated_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  canceled_at?: string | null;
}

export interface CreateBookingPayload {
  kind: ResourceKind;
  resource_id: number;
  resource_name: string;
  start_dt: string; // ISO
  end_dt: string;   // ISO
  quantity?: number;
  requester_name?: string;
  requester_role?: string;
  purpose?: string;
}

// ---------- Config ----------
export const BASE: string =
  (import.meta as any).env?.VITE_API_BASE || 'http://localhost:5174';

// ---------- Helpers ----------
function adminHeaders(): HeadersInit {
  const role = typeof window !== 'undefined'
    ? window.sessionStorage.getItem('demoRole')
    : null;
  return role ? { 'x-demo-role': role } : {};
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    try {
      const j = await res.clone().json();
      const msg: string = (j && (j.error || j.message)) ?? '';
      throw new Error(msg || `HTTP ${res.status} ${res.statusText}`);
    } catch {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status} ${res.statusText}`);
    }
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ---------- Health ----------
export function health(): Promise<{ ok: boolean }> {
  return http<{ ok: boolean }>('/api/health');
}

// ---------- Bookings ----------
export function listBookings(): Promise<Booking[]> {
  return http<Booking[]>('/api/bookings');
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  return http<Booking>('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function startBooking(id: number): Promise<Booking> {
  return http<Booking>(`/api/bookings/${id}/start`, {
    method: 'POST',
    headers: { ...adminHeaders() },
  });
}

export function finishBooking(id: number): Promise<Booking> {
  return http<Booking>(`/api/bookings/${id}/finish`, {
    method: 'POST',
    headers: { ...adminHeaders() },
  });
}

export function cancelBooking(id: number): Promise<Booking> {
  return http<Booking>(`/api/bookings/${id}/cancel`, {
    method: 'POST',
    headers: { ...adminHeaders() },
  });
}

// ---------- Resources ----------
export function listResources(kind?: ResourceKind): Promise<Resource[]> {
  const url = new URL('/api/resources', BASE);
  if (kind) url.searchParams.set('kind', kind);
  return http<Resource[]>(url.pathname + url.search);
}

export function createResource(
  data: Pick<Resource, 'kind' | 'name'> &
    Partial<Pick<Resource, 'subcategory' | 'type' | 'quantity' | 'status'>>
): Promise<Resource> {
  return http<Resource>('/api/resources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(data),
  });
}

export function updateResource(
  id: number,
  data: Partial<Pick<Resource, 'name' | 'subcategory' | 'type' | 'quantity' | 'status'>>
): Promise<Resource> {
  return http<Resource>(`/api/resources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(data),
  });
}

export function softDeleteResource(id: number): Promise<void> {
  return http<void>(`/api/resources/${id}`, {
    method: 'DELETE',
    headers: { ...adminHeaders() },
  });
}

// ---------- Back-compat shims ----------
export type Kind = ResourceKind;

export function resources(kind?: ResourceKind) { return listResources(kind); }
export function bookings() { return listBookings(); }
export function start(id: number) { return startBooking(id); }
export function finish(id: number) { return finishBooking(id); }
export function cancel(id: number) { return cancelBooking(id); }

// ---------- Default + named aggregate export ----------
const api = {
  BASE,
  // new names
  health,
  listBookings,
  createBooking,
  startBooking,
  finishBooking,
  cancelBooking,
  listResources,
  createResource,
  updateResource,
  softDeleteResource,
  // legacy aliases
  resources,
  bookings,
  start,
  finish,
  cancel,
};

export { api };     // named export
export default api; // default export
