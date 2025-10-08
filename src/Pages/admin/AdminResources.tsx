import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  type Booking,
  type BookingStatus,
} from "../../lib/api";

const KINDS = ["VEHICLE", "FACILITY", "EQUIPMENT"] as const satisfies readonly ResourceKind[];
const BOOKING_TABS: (BookingStatus | "ALL")[] = ["REQUEST", "ONGOING", "SUCCESS", "CANCEL", "ALL"];

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
  const n = useNavigate();
  const role = typeof window !== "undefined" ? window.sessionStorage.getItem("demoRole") : null;

  useEffect(() => {
    if (!role || (role !== "ADMIN" && role !== "STAFF")) n("/admin");
  }, [role, n]);

  // Top-level tab: "RESOURCES" | "APPROVALS"
  const [tab, setTab] = useState<"RESOURCES" | "APPROVALS">("RESOURCES");

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

  // ---- Resources load ----
  async function refreshResources() {
    setLoadingRes(true);
    setResErr(null);
    try {
      const rows = await listResources(kind);
      setItems(rows);
    } catch (e) {
      setResErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoadingRes(false);
    }
  }
  useEffect(() => { void refreshResources(); }, [kind]);

  // ---- Bookings load (Approvals) ----
  async function refreshBookings() {
    setLoadingBk(true);
    setBkErr(null);
    try {
      const rows = await listBookings();
      setBookings(rows);
    } catch (e) {
      setBkErr(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setLoadingBk(false);
    }
  }
  // Lazy-load bookings the first time Approvals tab is opened
  useEffect(() => {
    if (tab === "APPROVALS" && bookings.length === 0 && !loadingBk) {
      void refreshBookings();
    }
  }, [tab]);

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
        <h1 className="text-xl font-semibold">Admin</h1>
        <div className="flex items-center gap-2">
          <button
            className={`rounded-lg border px-3 py-2 ${tab === "RESOURCES" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("RESOURCES")}
          >
            Resources
          </button>
          <button
            className={`rounded-lg border px-3 py-2 ${tab === "APPROVALS" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("APPROVALS")}
          >
            Approvals
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
            {loadingRes && <div className="text-gray-600">Loading…</div>}
            {resErr && <div className="text-red-600">{String(resErr)}</div>}
            {!loadingRes && !resErr && items.length === 0 && <Empty kind={kind} />}
            {!loadingRes && !resErr && items.length > 0 && (
              <Table items={items} onChanged={refreshResources} />
            )}
          </main>
        </>
      )}

      {/* APPROVALS TAB */}
      {tab === "APPROVALS" && (
        <main className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Request Approvals</h2>
            <div className="flex items-center gap-2">
              <input
                className="border rounded-lg p-2"
                placeholder="Search by ID, resource, requester…"
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

          {loadingBk && <div className="text-gray-600">Loading bookings…</div>}
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
