import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import {
  // Resources
  listResources,
  createResource,
  updateResource,
  softDeleteResource,
  hardDeleteResource,
  type Resource,
  type ResourceKind,
  type ResourceStatus,
  // Bookings (for Approvals tab)
  listBookings,
  startBooking,
  finishBooking,
  cancelBooking,
  getBusyDayForecast,
  type Booking,
  type BookingStatus,
  type BusyDayForecast,
  type BusyDayForecastPoint,
} from "../../lib/api";
import { generateBusyDayForecast } from "../../lib/forecast";

const KINDS = ["VEHICLE", "FACILITY", "EQUIPMENT"] as const satisfies readonly ResourceKind[];
const BOOKING_TABS: (BookingStatus | "ALL")[] = ["REQUEST", "ONGOING", "SUCCESS", "CANCEL", "ALL"];
const FORECAST_HORIZON_DAYS = 14;

function buildBookingsSignature(list: Booking[]): string {
  return list
    .filter((b) => Boolean(b?.start_dt) && b.status !== "CANCEL")
    .map((b) => {
      const start = new Date(b.start_dt);
      const isoDate = Number.isNaN(start.getTime())
        ? "invalid"
        : `${start.getUTCFullYear()}-${`${start.getUTCMonth() + 1}`.padStart(2, "0")}-${`${start.getUTCDate()}`.padStart(2, "0")}`;
      const quantity = typeof b.quantity === "number" && b.quantity > 0 ? b.quantity : 1;
      return `${isoDate}:${quantity}`;
    })
    .sort()
    .join("|");
}

function normalizeErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred"
): string {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;
  const stripped = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return fallback;
  return stripped.replace(/^error\s+/i, "") || fallback;
}

function friendlyAnalyticsError(message: string): string {
  if (/cannot\s+get\s+\/api\/analytics\/busy-days/i.test(message)) {
    return "Analytics forecast endpoint unavailable.";
  }
  return message;
}

function fallbackForecastNote(hasBookings: boolean): string {
  return hasBookings
    ? "Using local moving-average forecast because the analytics endpoint is unavailable."
    : "Analytics forecast endpoint unavailable. Showing a local baseline until bookings are recorded.";
}

/* -------------------- Confirm Modal -------------------- */
function Confirm({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmClass = "",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border px-3 py-2" onClick={() => void onCancel()}>
            {cancelText}
          </button>
          <button
            className={`rounded-lg border px-3 py-2 ${confirmClass}`}
            onClick={() => void onConfirm()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Main Page with Tabs -------------------- */
export default function AdminResources() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) {
      navigate("/admin");
    }
  }, [user, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/admin");
  };

  // Top-level tab: "RESOURCES" | "DASHBOARD" | "APPROVALS"
  const [tab, setTab] = useState<"RESOURCES" | "DASHBOARD" | "APPROVALS">(
    "RESOURCES"
  );

  // Resources state
  const [kind, setKind] = useState<ResourceKind>("VEHICLE");
  const [items, setItems] = useState<Resource[]>([]);
  const [loadingRes, setLoadingRes] = useState<boolean>(true);
  const [resErr, setResErr] = useState<string | null>(null);

  // Approvals state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBk, setLoadingBk] = useState<boolean>(false);
  const [bkErr, setBkErr] = useState<string | null>(null);
  const [bkTab, setBkTab] = useState<BookingStatus | "ALL">("REQUEST");
  const [q, setQ] = useState("");
  const [forecast, setForecast] = useState<BusyDayForecast | null>(null);
  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);
  const [forecastErr, setForecastErr] = useState<string | null>(null);
  const [forecastNote, setForecastNote] = useState<string | null>(null);
  const [forecastAttempted, setForecastAttempted] = useState<boolean>(false);
  const [fallbackSignature, setFallbackSignature] = useState<string | null>(null);
  const bookingCount = bookings.length;

  // ---- Resources load ----
  const refreshResources = useCallback(async () => {
    setLoadingRes(true);
    setResErr(null);
    try {
      const rows = await listResources(kind);
      setItems(rows);
    } catch (e) {
      setResErr(normalizeErrorMessage(e, "Failed to load resources"));
    } finally {
      setLoadingRes(false);
    }
  }, [kind]);
  useEffect(() => { void refreshResources(); }, [kind, refreshResources]);

  // ---- Bookings load (Approvals) ----
  const refreshBookings = useCallback(async () => {
    setLoadingBk(true);
    setBkErr(null);
    try {
      const rows = await listBookings();
      setBookings(rows);
    } catch (e) {
      setBkErr(normalizeErrorMessage(e, "Failed to load bookings"));
    } finally {
      setLoadingBk(false);
    }
  }, []);
  // Lazy-load bookings the first time Approvals tab is opened
  useEffect(() => {
    const needsBookings = tab === "APPROVALS" || tab === "DASHBOARD";
    if (needsBookings && bookingCount === 0 && !loadingBk) {
      void refreshBookings();
    }
  }, [tab, bookingCount, loadingBk, refreshBookings]);

  const counts = useMemo(() => ({
    REQUEST: bookings.filter((b) => b.status === "REQUEST").length,
    ONGOING: bookings.filter((b) => b.status === "ONGOING").length,
    SUCCESS: bookings.filter((b) => b.status === "SUCCESS").length,
    CANCEL: bookings.filter((b) => b.status === "CANCEL").length,
  }), [bookings]);

  const filteredBookings = useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = bookings;
    if (bkTab !== "ALL") list = list.filter((b) => b.status === bkTab);
    if (text) {
      list = list.filter(
        (b) =>
          String(b.id).includes(text) ||
          b.resource_name.toLowerCase().includes(text) ||
          b.kind.toLowerCase().includes(text) ||
          (b.requester_name || "").toLowerCase().includes(text)
      );
    }
    // newest first by start time
    return list.sort((a, b) => new Date(b.start_dt).getTime() - new Date(a.start_dt).getTime());
  }, [bookings, bkTab, q]);

  const hasHistoricalBookings = useMemo(
    () => bookings.some((b) => b.status !== "CANCEL"),
    [bookings]
  );

  const loadForecast = useCallback(async () => {
    setLoadingForecast(true);
    setForecastErr(null);
    setForecastNote(null);
    try {
      const res = await getBusyDayForecast({ horizon_days: FORECAST_HORIZON_DAYS });
      setForecast({ ...res, usingFallback: res.usingFallback ?? false });
      setFallbackSignature(null);
      if (res.notes) {
        setForecastNote(res.notes);
      }
    } catch (error) {
      const message = normalizeErrorMessage(error, "Unable to fetch forecast");
      const fallback = generateBusyDayForecast(bookings, {
        horizonDays: FORECAST_HORIZON_DAYS,
      });
      const analyticsUnavailable = friendlyAnalyticsError(message);
      const hasBookings = bookings.length > 0;
      setForecast(fallback);
      setForecastNote(fallbackForecastNote(hasBookings));
      setForecastErr(hasBookings ? analyticsUnavailable : null);
      setFallbackSignature(buildBookingsSignature(bookings));
    } finally {
      setLoadingForecast(false);
      setForecastAttempted(true);
    }
  }, [bookings]);

  useEffect(() => {
    if (tab !== "DASHBOARD") return;
    if (loadingForecast) return;
    if (forecast) return;
    if (forecastAttempted) return;
    void loadForecast();
  }, [tab, loadingForecast, forecast, forecastAttempted, loadForecast]);

  useEffect(() => {
    if (tab !== "DASHBOARD") return;
    if (!forecastAttempted) return;
    if (forecast) return;
    if (loadingForecast) return;
    if (bookingCount === 0) return;
    void loadForecast();
  }, [tab, forecastAttempted, forecast, loadingForecast, bookingCount, loadForecast]);

  useEffect(() => {
    if (!forecast?.usingFallback) return;
    const signature = buildBookingsSignature(bookings);
    if (signature === fallbackSignature) return;
    const fallback = generateBusyDayForecast(bookings, {
      horizonDays: FORECAST_HORIZON_DAYS,
    });
    setFallbackSignature(signature);
    setForecast(fallback);
  }, [bookings, fallbackSignature, forecast]);

  const handleForecastRefresh = useCallback(() => {
    void loadForecast();
  }, [loadForecast]);

  const shouldShowForecastCard = loadingForecast || forecastAttempted || Boolean(forecast);

  // ---- Booking actions ----
  async function approve(id: number) {
    try {
      const updated = await startBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approval failed");
    }
  }
  async function reject(id: number) {
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reject failed");
    }
  }
  async function markReturned(id: number) {
    try {
      const updated = await finishBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Finish failed");
    }
  }
  async function cancelOngoing(id: number) {
    try {
      const updated = await cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cancel failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with tabs */}
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Admin</h1>
          {user && (
            <span className="text-sm text-gray-600">
              Welcome, {user.username} ({user.role})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`rounded-lg border px-3 py-2 ${tab === "RESOURCES" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("RESOURCES")}
          >
            Resources
          </button>
          <button
            className={`rounded-lg border px-3 py-2 ${tab === "DASHBOARD" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("DASHBOARD")}
          >
            Dashboard
          </button>
          <button
            className={`rounded-lg border px-3 py-2 ${tab === "APPROVALS" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("APPROVALS")}
          >
            Approvals
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-red-600 hover:bg-red-50"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {/* RESOURCES TAB */}
      {tab === "RESOURCES" && (
        <>
          <div className="flex items-center justify-between p-4 border-b bg-white">
            <h2 className="text-base font-semibold">Manage Resources</h2>
            <div className="flex items-center gap-2">
              <select
                className="border rounded-lg p-2"
                value={kind}
                onChange={(e) => setKind(e.target.value as ResourceKind)}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <CreateButton kind={kind} onCreated={refreshResources} />
            </div>
          </div>

          <main className="p-4">
            {loadingRes && <div className="text-gray-600">Loading...</div>}
            {resErr && <div className="text-red-600">{String(resErr)}</div>}
            {!loadingRes && !resErr && items.length === 0 && <Empty kind={kind} />}
            {!loadingRes && !resErr && items.length > 0 && (
              <Table items={items} onChanged={refreshResources} />
            )}
          </main>
        </>
      )}

      {/* DASHBOARD TAB */}
      {tab === "DASHBOARD" && (
        <main className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Dashboard</h2>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border px-3 py-2 disabled:opacity-60"
                onClick={() => void refreshBookings()}
                disabled={loadingBk}
              >
                {loadingBk ? "Refreshing..." : "Refresh bookings"}
              </button>
            </div>
          </div>

          {shouldShowForecastCard && (
            <ForecastSummary
              forecast={forecast}
              loading={loadingForecast}
              error={forecastErr}
              note={forecastNote}
              attempted={forecastAttempted}
              hasHistory={hasHistoricalBookings}
              onRefresh={handleForecastRefresh}
            />
          )}

          {bkErr && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {bkErr}
            </div>
          )}

          {!loadingBk && bookingCount === 0 && !bkErr && (
            <p className="text-sm text-gray-600">No bookings recorded yet.</p>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { key: "total", label: "Total bookings", value: bookingCount },
              { key: "request", label: "Pending requests", value: counts.REQUEST },
              { key: "ongoing", label: "Ongoing", value: counts.ONGOING },
              { key: "success", label: "Completed", value: counts.SUCCESS },
              { key: "cancel", label: "Cancelled", value: counts.CANCEL },
            ].map(({ key, label, value }) => (
              <div key={key} className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </section>
        </main>
      )}

      {/* APPROVALS TAB */}
      {tab === "APPROVALS" && (
        <main className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Request Approvals</h2>
            <div className="flex items-center gap-2">
              <input
                className="border rounded-lg p-2"
                placeholder="Search by ID, resource, requester..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="rounded-lg border px-3 py-2" onClick={() => void refreshBookings()}>
                Refresh
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {BOOKING_TABS.map((t) => (
              <button
                key={t}
                className={`rounded-lg border px-3 py-1 text-sm ${
                  bkTab === t ? "bg-gray-100" : ""
                }`}
                onClick={() => setBkTab(t)}
              >
                {t === "REQUEST" && `Request (${counts.REQUEST})`}
                {t === "ONGOING" && `Ongoing (${counts.ONGOING})`}
                {t === "SUCCESS" && `Success (${counts.SUCCESS})`}
                {t === "CANCEL" && `Cancel (${counts.CANCEL})`}
                {t === "ALL" && "All"}
              </button>
            ))}
          </div>

          {loadingBk && <div className="text-gray-600">Loading bookings...</div>}
          {bkErr && <div className="text-red-600">{String(bkErr)}</div>}

          {!loadingBk && !bkErr && (
            <div className="overflow-x-auto bg-white rounded-2xl shadow">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
                    <th>ID</th>
                    <th>Resource</th>
                    <th>Kind</th>
                    <th>When</th>
                    <th>Requester</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-600">
                        No bookings in this view.
                      </td>
                    </tr>
                  )}
                  {filteredBookings.map((b) => (
                    <tr key={b.id} className="[&>td]:px-4 [&>td]:py-2 border-t">
                      <td className="font-mono">#{b.id}</td>
                      <td className="font-medium">{b.resource_name}</td>
                      <td className="text-gray-700">{b.kind}</td>
                      <td className="text-gray-700">
                        {new Date(b.start_dt).toLocaleString()} — {new Date(b.end_dt).toLocaleString()}
                      </td>
                      <td className="text-gray-700">
                        {b.requester_name || "—"} {b.requester_role ? `(${b.requester_role})` : ""}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs ${
                            b.status === "REQUEST"
                              ? "bg-amber-100 text-amber-800"
                              : b.status === "ONGOING"
                              ? "bg-blue-100 text-blue-800"
                              : b.status === "SUCCESS"
                              ? "bg-green-100 text-green-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="flex flex-wrap gap-2">
                        {b.status === "REQUEST" && (
                          <>
                            <button
                              className="rounded-lg border px-3 py-1"
                              onClick={() => void approve(b.id)}
                            >
                              Approve
                            </button>
                            <button
                              className="rounded-lg border px-3 py-1"
                              onClick={() => void reject(b.id)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {b.status === "ONGOING" && (
                          <>
                            <button
                              className="rounded-lg border px-3 py-1"
                              onClick={() => void markReturned(b.id)}
                            >
                              Mark Returned
                            </button>
                            <button
                              className="rounded-lg border px-3 py-1"
                              onClick={() => void cancelOngoing(b.id)}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {b.status === "SUCCESS" && (
                          <span className="text-gray-600">Completed</span>
                        )}
                        {b.status === "CANCEL" && (
                          <span className="text-gray-600">Canceled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

function ForecastSummary({
  forecast,
  loading,
  error,
  note,
  attempted,
  hasHistory,
  onRefresh,
}: {
  forecast: BusyDayForecast | null;
  loading: boolean;
  error: string | null;
  note: string | null;
  attempted: boolean;
  hasHistory: boolean;
  onRefresh: () => void;
}) {
  const points = useMemo(() => {
    if (!forecast) return [];
    return [...forecast.points]
      .slice(0, 7)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [forecast]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    []
  );

  const renderBadge = (label: BusyDayForecastPoint["label"]) => {
    const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
    if (label === "BUSY") return `${base} bg-rose-100 text-rose-700`;
    if (label === "QUIET") return `${base} bg-sky-100 text-sky-700`;
    return `${base} bg-emerald-100 text-emerald-700`;
  };

  const showEmptyState = !loading && !forecast && attempted && !error;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Demand forecast</h3>
          <p className="text-xs text-gray-500">
            Next {forecast?.horizon_days ?? FORECAST_HORIZON_DAYS} days - {forecast?.model ?? "moving-average"}
          </p>
          {forecast?.usingFallback && (
            <span className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
              Local fallback
            </span>
          )}
        </div>
        <button
          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading && <p className="mt-3 text-sm text-gray-600">Loading forecast...</p>}

      {!loading && error && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      {!loading && note && (
        <p className="mt-3 text-xs text-gray-600">{note}</p>
      )}

      {showEmptyState && !hasHistory && (
        <p className="mt-3 text-sm text-gray-600">
          Add bookings to build enough history for a forecast.
        </p>
      )}

      {forecast && !loading && points.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-2 pb-2 font-medium">Date</th>
                <th className="px-2 pb-2 font-medium">Label</th>
                <th className="px-2 pb-2 font-medium">Busy %</th>
                <th className="px-2 pb-2 font-medium">Expected bookings</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {points.map((point) => {
                const date = new Date(`${point.date}T00:00:00`);
                const percent = Math.round(point.busyProbability * 100);
                return (
                  <tr key={point.date} className="border-t border-gray-100">
                    <td className="px-2 py-2">{formatter.format(date)}</td>
                    <td className="px-2 py-2">
                      <span className={renderBadge(point.label)}>{point.label}</span>
                    </td>
                    <td className="px-2 py-2 font-semibold">{percent}%</td>
                    <td className="px-2 py-2">{point.expectedBookings.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* -------------------- Subcomponents (Resources tab) -------------------- */

function Empty({ kind }: { kind: ResourceKind }) {
  return (
    <div className="grid place-items-center py-24">
      <div className="text-center space-y-2">
        <div className="text-4xl">🗂️</div>
        <p className="text-lg font-medium">No {kind.toLowerCase()}s yet</p>
        <p className="text-gray-600">
          Add your first {kind.toLowerCase()} using the “Create” button.
        </p>
      </div>
    </div>
  );
}

function Table({
  items,
  onChanged,
}: {
  items: Resource[];
  onChanged: () => void | Promise<void>;
}) {
  return (
    <div className="overflow-x-auto bg-white rounded-2xl shadow">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr className="[&>th]:px-4 [&>th]:py-2 text-left">
            <th>Name</th>
            <th>Subcategory</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <Row key={r.id} r={r} onChanged={onChanged} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------- Row -------------------- */
function Row({ r, onChanged }: { r: Resource; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [showSoftConfirm, setShowSoftConfirm] = useState(false);
  const [showHardConfirm, setShowHardConfirm] = useState(false);

  const inc = async (delta: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await updateResource(r.id, { quantity: Math.max(0, r.quantity + delta) });
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleMaint = async () => {
    const next: ResourceStatus = r.status === "Maintenance" ? "Available" : "Maintenance";
    setBusy(true);
    try {
      await updateResource(r.id, { status: next });
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const doSoftDelete = async () => {
    setBusy(true);
    try {
      await softDeleteResource(r.id);
      await onChanged();
    } catch (e) {
    alert(e instanceof Error ? e.message : "Soft delete failed");
    } finally {
      setBusy(false);
      setShowSoftConfirm(false);
    }
  };

  const doHardDelete = async () => {
    setBusy(true);
    try {
      await hardDeleteResource(r.id);
      await onChanged();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "Hard delete failed (resource may be referenced by bookings)"
      );
    } finally {
      setBusy(false);
      setShowHardConfirm(false);
    }
  };

  return (
    <>
      <tr className="[&>td]:px-4 [&>td]:py-2 border-t">
        <td className="font-medium">{r.name}</td>
        <td className="text-gray-700">{r.subcategory || "—"}</td>
        <td className="text-gray-700">{r.type || "—"}</td>
        <td className="font-mono">
          <div className="inline-flex items-center gap-2">
            <button
              className="rounded-lg border px-2"
              onClick={() => void inc(-1)}
              disabled={busy || r.quantity === 0}
            >
              −
            </button>
            {r.quantity}
            <button
              className="rounded-lg border px-2"
              onClick={() => void inc(+1)}
              disabled={busy}
            >
              +
            </button>
          </div>
        </td>
        <td>
          <span
            className={`px-2 py-1 rounded-lg text-xs ${
              r.status === "Available"
                ? "bg-green-100 text-green-800"
                : r.status === "Maintenance"
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {r.status}
          </span>
        </td>
        <td className="flex gap-2">
          <EditButton r={r} onSaved={onChanged} />
          <button className="rounded-lg border px-3 py-1" onClick={() => void toggleMaint()} disabled={busy}>
            {r.status === "Maintenance" ? "Clear Maintenance" : "Mark Maintenance"}
          </button>
          <button
            className="rounded-lg border px-3 py-1 text-red-600"
            onClick={() => setShowSoftConfirm(true)}
            disabled={busy}
          >
            Set Inactive
          </button>
          <button
            className="rounded-lg border px-3 py-1 text-white bg-red-600"
            onClick={() => setShowHardConfirm(true)}
            disabled={busy}
          >
            Delete
          </button>
        </td>
      </tr>

      <Confirm
        open={showSoftConfirm}
        title={`Set "${r.name}" to Inactive?`}
        message="This is reversible. You can edit later to reactivate it."
        confirmText="Set Inactive"
        onConfirm={doSoftDelete}
        onCancel={() => setShowSoftConfirm(false)}
      />

      <Confirm
        open={showHardConfirm}
        title={`Permanently delete "${r.name}"?`}
        message="This cannot be undone. You can only delete if there are no bookings tied to this resource."
        confirmText="Delete permanently"
        confirmClass="bg-red-600 text-white"
        onConfirm={doHardDelete}
        onCancel={() => setShowHardConfirm(false)}
      />
    </>
  );
}

/* -------------------- Create & Edit -------------------- */
function CreateButton({
  kind,
  onCreated,
}: {
  kind: ResourceKind;
  onCreated: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded-xl border px-3 py-2" onClick={() => setOpen(true)}>
        Create
      </button>
      {open && (
        <ResourceModal
          kind={kind}
          onClose={() => setOpen(false)}
          onSaved={onCreated}
        />
      )}
    </>
  );
}

function EditButton({
  r,
  onSaved,
}: {
  r: Resource;
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="rounded-lg border px-3 py-1" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <ResourceModal
          resource={r}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

/* -------------------- Resource Modal -------------------- */
type ModalProps =
  | {
      kind: ResourceKind;
      resource?: undefined;
      onClose: () => void;
      onSaved: () => void | Promise<void>;
    }
  | {
      kind?: undefined;
      resource: Resource;
      onClose: () => void;
      onSaved: () => void | Promise<void>;
    };

function ResourceModal(props: ModalProps) {
  const isEdit = !!props.resource;

  const [form, setForm] = useState<{
    kind: ResourceKind;
    name: string;
    subcategory: string;
    type: string;
    quantity: number;
    status: ResourceStatus;
  }>(() => ({
    kind: (props.resource?.kind ?? props.kind)!,
    name: props.resource?.name ?? "",
    subcategory: props.resource?.subcategory ?? "",
    type: props.resource?.type ?? "",
    quantity: props.resource?.quantity ?? 1,
    status: (props.resource?.status ?? "Available") as ResourceStatus,
  }));

  const disabled = useMemo(
    () => form.name.trim().length === 0 || form.quantity < 0,
    [form]
  );

  async function save() {
    try {
      if (isEdit && props.resource) {
        await updateResource(props.resource.id, {
          name: form.name,
          subcategory: form.subcategory,
          type: form.type,
          quantity: Number(form.quantity),
          status: form.status,
        });
      } else {
        await createResource({
          kind: form.kind,
          name: form.name,
          subcategory: form.subcategory || undefined,
          type: form.type || undefined,
          quantity: Number(form.quantity),
          status: form.status,
        });
      }
      await props.onSaved();
      props.onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit" : "Create"} Resource</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="text-sm">Kind</span>
            <select
              className="w-full border rounded-lg p-2"
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as ResourceKind }))
              }
              disabled={isEdit}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2">
            <span className="text-sm">Name</span>
            <input
              className="w-full border rounded-lg p-2"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>

          <label>
            <span className="text-sm">Subcategory</span>
            <input
              className="w-full border rounded-lg p-2"
              value={form.subcategory}
              onChange={(e) =>
                setForm((f) => ({ ...f, subcategory: e.target.value }))
              }
            />
          </label>

          <label>
            <span className="text-sm">Type</span>
            <input
              className="w-full border rounded-lg p-2"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            />
          </label>

          <label>
            <span className="text-sm">Quantity</span>
            <input
              type="number"
              min={0}
              className="w-full border rounded-lg p-2"
              value={form.quantity}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: Number(e.target.value) }))
              }
            />
          </label>

          <label>
            <span className="text-sm">Status</span>
            <select
              className="w-full border rounded-lg p-2"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as ResourceStatus }))
              }
            >
              <option>Available</option>
              <option>Maintenance</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="rounded-lg border px-3 py-2" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="rounded-lg border px-3 py-2 disabled:opacity-50"
            onClick={() => void save()}
            disabled={disabled}
          >
            {isEdit ? "Save changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
