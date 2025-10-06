import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, {
  listResources,
  updateResource,
  softDeleteResource,
  type Resource,
  type ResourceKind,
  type ResourceStatus,
} from "../../lib/api";

const KINDS = ["VEHICLE", "FACILITY", "EQUIPMENT"] as const satisfies readonly ResourceKind[];

export default function AdminResources() {
  const n = useNavigate();
  const role = typeof window !== "undefined" ? window.sessionStorage.getItem("demoRole") : null;

  useEffect(() => {
    if (!role || (role !== "ADMIN" && role !== "STAFF")) n("/admin");
  }, [role, n]);

  const [kind, setKind] = useState<ResourceKind>("VEHICLE");
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await listResources(kind);
      setItems(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [kind]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between p-4 border-b bg-white">
        <h1 className="text-xl font-semibold">Admin • Resources</h1>
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
          <CreateButton kind={kind} onCreated={refresh} />
        </div>
      </header>

      <main className="p-4">
        {loading && <div className="text-gray-600">Loading…</div>}
        {err && <div className="text-red-600">{String(err)}</div>}
        {!loading && !err && items.length === 0 && <Empty kind={kind} />}
        {!loading && !err && items.length > 0 && <Table items={items} onChanged={refresh} />}
      </main>
    </div>
  );
}

/* -------------------- subcomponents -------------------- */

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

function Row({ r, onChanged }: { r: Resource; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);

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

  const remove = async () => {
    if (!confirm(`Set "${r.name}" to Inactive?`)) return;
    setBusy(true);
    try {
      await softDeleteResource(r.id);
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
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
          <button className="rounded-lg border px-2" onClick={() => void inc(+1)} disabled={busy}>
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
        <button className="rounded-lg border px-3 py-1 text-red-600" onClick={() => void remove()} disabled={busy}>
          Set Inactive
        </button>
      </td>
    </tr>
  );
}

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
        await api.createResource({
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
