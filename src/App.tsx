import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Car,
  Monitor,
  Building2,
  Search,
  QrCode,
  Plus,
  CheckCircle2,
  XCircle,
  Clock4,
  ClipboardList,
  Layers3,
  Filter,
  Download,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, type Booking, type BookingStatus, type Kind, type Resource } from "./lib/api";
import { toast } from "sonner";

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Icon className="h-6 w-6" /> {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-700",
  "Under Maintenance": "bg-amber-100 text-amber-700",
  Maintenance: "bg-amber-100 text-amber-700",
  Booked: "bg-rose-100 text-rose-700",
};

// helper: return list of resources given Kind
function resourcesOf(
  kind: Kind,
  all: { vehicles: Resource[]; facilities: Resource[]; equipment: Resource[] }
) {
  if (kind === "VEHICLE") return all.vehicles;
  if (kind === "FACILITY") return all.facilities;
  return all.equipment;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] =
    useState<"vehicles" | "facilities" | "equipment">("vehicles");

  const [openSheet, setOpenSheet] = useState(false);
  const [prefill, setPrefill] = useState<{ kind: Kind; id: number; name: string } | null>(null);

  const [vehicles, setVehicles] = useState<Resource[]>([]);
  const [facilities, setFacilities] = useState<Resource[]>([]);
  const [equipment, setEquipment] = useState<Resource[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // requester info persisted locally
  const [rqName, setRqName] = useState<string>(() => localStorage.getItem("rb_rq_name") || "");
  const [rqRole, setRqRole] = useState<string>(
    () => localStorage.getItem("rb_rq_role") || "STUDENT"
  );
  useEffect(() => { localStorage.setItem("rb_rq_name", rqName); }, [rqName]);
  useEffect(() => { localStorage.setItem("rb_rq_role", rqRole); }, [rqRole]);

  async function loadAll() {
    try {
      setLoading(true);
      setErr(null);
      const [veh, fac, eqp, bks] = await Promise.all([
        api.resources("VEHICLE"),
        api.resources("FACILITY"),
        api.resources("EQUIPMENT"),
        api.bookings(),
      ]);
      setVehicles(veh);
      setFacilities(fac);
      setEquipment(eqp);
      setBookings(bks);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => v.name.toLowerCase().includes(query.toLowerCase())),
    [vehicles, query]
  );
  const filteredFacilities = useMemo(
    () => facilities.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [facilities, query]
  );
  const filteredEquipment = useMemo(
    () => equipment.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())),
    [equipment, query]
  );

  const startBooking = (kind: Kind, id: number, name: string) => {
    setPrefill({ kind, id, name });
    setOpenSheet(true);
  };

  function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return !(aEnd <= bStart || aStart >= bEnd);
  }
  function hasLocalConflict(kind: Kind, resourceId: number, startISO: string, endISO: string) {
    const s = new Date(startISO);
    const e = new Date(endISO);
    return bookings.some(
      (b) =>
        b.kind === kind &&
        b.resource_id === resourceId &&
        (b.status === "REQUEST" || b.status === "ONGOING") &&
        overlaps(s, e, new Date(b.start_dt), new Date(b.end_dt))
    );
  }

  async function createBookingFromDrawer() {
    const startEl = document.getElementById("start-dt") as HTMLInputElement | null;
    const endEl = document.getElementById("end-dt") as HTMLInputElement | null;
    const qtyEl = document.getElementById("qty") as HTMLInputElement | null;
    const purposeEl = document.getElementById("purpose") as HTMLInputElement | null;

    if (!prefill) return;

    // Validate requester
    if (!rqName.trim()) {
      toast.error("Please enter your name (Requester).");
      return;
    }

    if (!startEl?.value || !endEl?.value) {
      toast.error("Please set start and end.");
      return;
    }

    // ensure we have a valid resource id
    if (!prefill.id || prefill.id <= 0) {
      toast.error("Please select a resource.");
      return;
    }

    // Local pre-check
    const startISO = new Date(startEl.value).toISOString();
    const endISO = new Date(endEl.value).toISOString();
    if (hasLocalConflict(prefill.kind, prefill.id, startISO, endISO)) {
      toast.error("Conflicts with an existing booking.");
      return;
    }

    try {
      const created = await api.createBooking({
        kind: prefill.kind,
        resource_id: Number(prefill.id),
        resource_name: prefill.name,
        start_dt: startISO,
        end_dt: endISO,
        quantity: prefill.kind === "EQUIPMENT" ? Number(qtyEl?.value || 1) : undefined,
        purpose: purposeEl?.value || undefined,
        requester_name: rqName.trim(),
        requester_role: rqRole || "STUDENT",
      });
      setBookings((prev) => [created, ...prev]);
      setOpenSheet(false);
      toast.success(`${prefill?.name ?? "Resource"} booked successfully.`);
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      if (status === 409) {
        toast.error("That resource is already booked for this time window.");
      } else {
        toast.error(e?.message || "Booking failed");
      }
    }
  }

  async function updateStatus(id: number, target: BookingStatus) {
    try {
      let updated: Booking;
      if (target === "ONGOING") updated = await api.start(id);
      else if (target === "SUCCESS") updated = await api.finish(id);
      else if (target === "CANCEL") updated = await api.cancel(id);
      else return;
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      toast(`Booking ${target}`, { description: `Booking #${id} marked as ${target}.` });
    } catch (e: any) {
      toast.error(e.message || "Update failed");
    }
  }

  // map current active tab to Kind
  const tabToKind = {
    vehicles: "VEHICLE",
    facilities: "FACILITY",
    equipment: "EQUIPMENT",
  } as const;

  // -- UI --
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2"
          >
            <Layers3 className="h-6 w-6" />
            <span className="font-semibold">MMCM Resource Booking</span>
          </motion.div>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vehicles, rooms, equipment…"
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="hidden sm:inline-flex">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            {/* NEW BOOKING: seed from active tab's first resource */}
            <Button
              onClick={() => {
                const list =
                  activeTab === "vehicles" ? vehicles :
                  activeTab === "facilities" ? facilities :
                  equipment;

                const first = list[0];
                if (!first) {
                  return toast.error("No resources available in this tab. Add one or switch tabs.");
                }
                setPrefill({
                  kind: tabToKind[activeTab],
                  id: first.id,
                  name: first.name,
                });
                setOpenSheet(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> New Booking
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <SectionHeader
            icon={ClipboardList}
            title="Resources"
            subtitle="Vehicles, Facilities, and Equipment available on campus"
          />
          {err && <div className="mt-3 text-sm text-rose-600">Error: {err}</div>}
          {loading && <div className="mt-3 text-sm text-muted-foreground">Loading resources…</div>}

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mt-4">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
              <TabsTrigger value="vehicles" className="gap-2">
                <Car className="h-4 w-4" />
                Vehicles
              </TabsTrigger>
              <TabsTrigger value="facilities" className="gap-2">
                <Building2 className="h-4 w-4" />
                Facilities
              </TabsTrigger>
              <TabsTrigger value="equipment" className="gap-2">
                <Monitor className="h-4 w-4" />
                Equipment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles" className="mt-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredVehicles.map((v) => (
                  <Card key={v.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{v.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Type: {v.type ?? "Vehicle"} • Qty: {v.quantity}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            "border-none",
                            STATUS_COLORS[v.status as keyof typeof STATUS_COLORS] ||
                              "bg-gray-100 text-gray-700"
                          )}
                        >
                          {v.status}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("VEHICLE", v.id, v.name)}>
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Book
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <QrCode className="h-4 w-4" />
                          View QR
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="facilities" className="mt-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredFacilities.map((f) => (
                  <Card key={f.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{f.name}</h3>
                          <p className="text-sm text-muted-foreground">Category: {f.subcategory ?? "Facility"}</p>
                        </div>
                        <Badge
                          className={cn(
                            "border-none",
                            STATUS_COLORS[f.status as keyof typeof STATUS_COLORS] ||
                              "bg-gray-100 text-gray-700"
                          )}
                        >
                          {f.status}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("FACILITY", f.id, f.name)}>
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Book
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          Details <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="equipment" className="mt-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredEquipment.map((e) => (
                  <Card key={e.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <h3 className="font-medium">{e.name}</h3>
                      <p className="text-sm text-muted-foreground">Total: {e.quantity}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("EQUIPMENT", e.id, e.name)}>
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Book
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          Reserve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        <section className="lg:col-span-1">
          <SectionHeader
            icon={Clock4}
            title="Bookings"
            subtitle="Track Request → Ongoing → Success → Cancel"
          />
          <Tabs defaultValue="REQUEST" className="mt-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="REQUEST">Request</TabsTrigger>
              <TabsTrigger value="ONGOING">Ongoing</TabsTrigger>
              <TabsTrigger value="SUCCESS">Success</TabsTrigger>
              <TabsTrigger value="CANCEL">Cancel</TabsTrigger>
            </TabsList>

            {(["REQUEST", "ONGOING", "SUCCESS", "CANCEL"] as BookingStatus[]).map((status) => (
              <TabsContent key={status} value={status} className="mt-4 space-y-3">
                {bookings.filter((b) => b.status === status).length === 0 && (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      No {status.toLowerCase()} bookings.
                    </CardContent>
                  </Card>
                )}
                {bookings
                  .filter((b) => b.status === status)
                  .map((b) => (
                    <Card key={b.id} className="hover:shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {b.resource_name}{" "}
                              <span className="text-muted-foreground">({b.kind})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(b.start_dt).toLocaleString()} —{" "}
                              {new Date(b.end_dt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === "REQUEST" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatus(b.id, "CANCEL")}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => updateStatus(b.id, "ONGOING")}>
                                  <QrCode className="h-4 w-4 mr-1" />
                                  Start (Scan)
                                </Button>
                              </>
                            )}
                            {status === "ONGOING" && (
                              <Button size="sm" onClick={() => updateStatus(b.id, "SUCCESS")}>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Finish
                              </Button>
                            )}
                            {status === "SUCCESS" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Download className="h-4 w-4 mr-1" />
                                    Slip
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Booking Slip (Preview)</DialogTitle>
                                    <DialogDescription>
                                      Printable trip ticket / handover slip will be generated here.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="text-sm">
                                    <p>
                                      <strong>ID:</strong> {b.id}
                                    </p>
                                    <p>
                                      <strong>Resource:</strong> {b.resource_name}
                                    </p>
                                    <p>
                                      <strong>When:</strong> {new Date(b.start_dt).toLocaleString()} —{" "}
                                      {new Date(b.end_dt).toLocaleString()}
                                    </p>
                                  </div>
                                  <DialogFooter>
                                    <Button>Download PDF</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        </section>
      </main>

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" /> New Booking
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Resource type + resource */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resource Type</Label>
                <Select
                  defaultValue={prefill?.kind ?? "VEHICLE"}
                  onValueChange={(v) => {
                    if (!prefill) return;
                    // auto-pick the first resource of the new kind
                    const list = resourcesOf(v as Kind, { vehicles, facilities, equipment });
                    const first = list[0];
                    setPrefill({
                      ...prefill,
                      kind: v as Kind,
                      id: first ? first.id : 0,
                      name: first ? first.name : "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VEHICLE">Vehicle</SelectItem>
                    <SelectItem value="FACILITY">Facility</SelectItem>
                    <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resource</Label>
                <Select
                  value={prefill?.id ? String(prefill.id) : ""}
                  onValueChange={(val) => {
                    if (!prefill) return;
                    const list = resourcesOf(prefill.kind, { vehicles, facilities, equipment });
                    const picked = list.find((r) => String(r.id) === val);
                    if (picked) setPrefill({ ...prefill, id: picked.id, name: picked.name });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourcesOf(prefill?.kind ?? "VEHICLE", { vehicles, facilities, equipment }).map(
                      (r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Prefilled from card — replace if needed.
                </p>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="datetime-local" id="start-dt" />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input type="datetime-local" id="end-dt" />
              </div>
            </div>

            {/* Requester information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Requester Name</Label>
                <Input
                  id="rq-name"
                  placeholder="Your full name"
                  value={rqName}
                  onChange={(e) => setRqName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Please Enter Fullname</p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={rqRole} onValueChange={setRqRole}>
                  <SelectTrigger id="rq-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity (equipment only) */}
            {prefill?.kind === "EQUIPMENT" && (
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min={1} defaultValue={1} id="qty" />
              </div>
            )}

            {/* Purpose */}
            <div className="space-y-2">
              <Label>Purpose / Event</Label>
              <Input placeholder="e.g., Department seminar, Org event, Class session" id="purpose" />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenSheet(false)}>
                Cancel
              </Button>
              <Button onClick={createBookingFromDrawer}>Submit Request</Button>
            </div>

            <div className="border-t pt-4 text-xs text-muted-foreground">
              <p>
                Workflow preview: <strong>REQUEST</strong> → <strong>ONGOING</strong> (scan QR at pickup) →{" "}
                <strong>SUCCESS</strong> (return) or <strong>CANCEL</strong>.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <footer className="py-10 border-t mt-auto bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
          <span>Local-Hosted MMCM Resource Booking • Counter:Strike Top 200 PH</span>
          <span>Statuses: REQUEST • ONGOING • SUCCESS • CANCEL</span>
        </div>
      </footer>
    </div>
  );
}
