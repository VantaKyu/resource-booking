import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Car, Monitor, Building2, Search, QrCode, Plus, CheckCircle2, XCircle, Clock4, ClipboardList, Users2, Layers3, Filter, Download, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * MMCM Resource Booking App — Local-Hosted (Frontend MVP)
 * ------------------------------------------------------
 * - One-file React component you can drop into a Vite/Next.js app.
 * - Tailwind CSS for styling, shadcn/ui for components, lucide-react for icons.
 * - Contains:
 *    • Top navigation with search & filters
 *    • Tabs for Resources (Vehicles, Facilities, Equipment)
 *    • Resource cards with availability status
 *    • Booking Sheet (form) with the four statuses you defined: REQUEST, ONGOING, SUCCESS, CANCEL
 *    • "My Bookings" panel with tabs
 * - Data is mocked in-memory for now; wire to your backend later.
 */

// ---------------------- Mock Data ----------------------
const VEHICLES = [
  { id: "veh-1", name: "Car 1", plate: "ABC-001", seats: 5, status: "Available" },
  { id: "veh-2", name: "Car 2", plate: "ABC-002", seats: 5, status: "Available" },
  { id: "veh-3", name: "Car 3", plate: "ABC-003", seats: 7, status: "Maintenance" },
  { id: "veh-4", name: "Car 4", plate: "ABC-004", seats: 5, status: "Booked" },
  { id: "veh-5", name: "Car 5", plate: "ABC-005", seats: 5, status: "Available" },
];

const FACILITIES = [
  "Lecture Room",
  "Drawing Room",
  "Computer Lab",
  "Chemistry Lab",
  "Engineering Lab",
  "Auditorium 1",
  "Auditorium 2",
  "Auditorium 3",
  "Drawing Lab 3",
  "Plaza",
  "Playcourt 1",
  "Playcourt 2",
  "Playcourt 3",
  "Playcourt 4",
  "Volleyball Court",
  "Futsal Court",
].map((name, i) => ({ id: `fac-${i + 1}`, name, status: i % 7 === 0 ? "Under Maintenance" : "Available" }));

const EQUIPMENT = {
  Furniture: {
    Chairs: [
      { id: "eq-ch-rabami", name: "Chair – Rabami", total: 50, available: 44 },
      { id: "eq-ch-monobloc", name: "Chair – Monobloc", total: 100, available: 72 },
      { id: "eq-ch-stool", name: "Chair – Stool", total: 30, available: 25 },
    ],
    Tables: [
      { id: "eq-tb-trapezoid", name: "Table – Trapezoid", total: 10, available: 8 },
      { id: "eq-tb-training", name: "Table – Training (Long)", total: 12, available: 12 },
      { id: "eq-tb-round-s", name: "Table – Round (Small)", total: 10, available: 7 },
      { id: "eq-tb-round-b", name: "Table – Round (Big)", total: 6, available: 5 },
      { id: "eq-tb-fold-s", name: "Table – Foldable (Small)", total: 15, available: 10 },
      { id: "eq-tb-cocktail", name: "Table – Cocktail", total: 8, available: 6 },
    ],
  },
  "Audio/Visual": {
    Devices: [
      { id: "eq-tv", name: "TV", total: 6, available: 4 },
      { id: "eq-pc-win", name: "Computer – Windows", total: 12, available: 9 },
      { id: "eq-pc-mac", name: "Computer – Mac", total: 5, available: 3 },
      { id: "eq-projector", name: "Projector", total: 7, available: 5 },
    ],
    Audio: [
      { id: "eq-mic-wired", name: "Microphone – Wired", total: 20, available: 16 },
      { id: "eq-mic-wireless", name: "Microphone – Wireless", total: 12, available: 8 },
      { id: "eq-spk-s", name: "Portable Speaker – Small", total: 6, available: 5 },
      { id: "eq-spk-b", name: "Portable Speaker – Big", total: 4, available: 3 },
    ],
  },
  Accessories: {
    Misc: [
      { id: "eq-podium", name: "Podium", total: 2, available: 2 },
      { id: "eq-flags", name: "Flags", total: 10, available: 7 },
      { id: "eq-ext", name: "Extension Wires", total: 20, available: 15 },
      { id: "eq-spk-stand", name: "Speaker Stand", total: 6, available: 4 },
      { id: "eq-mic-stand", name: "Microphone Stand", total: 10, available: 8 },
      { id: "eq-mixer", name: "Mixer", total: 3, available: 2 },
      { id: "eq-clicker", name: "Clicker", total: 6, available: 6 },
    ],
  },
  Others: {
    Misc: [
      { id: "eq-other-manual", name: "Manual Entry (Specify)", total: 999, available: 999 },
      { id: "eq-sports", name: "Sports Equipment (Specify)", total: 999, available: 999 },
    ],
  },
};

const STATUS_COLORS: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-700",
  "Under Maintenance": "bg-amber-100 text-amber-700",
  Maintenance: "bg-amber-100 text-amber-700",
  Booked: "bg-rose-100 text-rose-700",
};

// ---------------------- Utilities ----------------------
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
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

// ---------------------- Booking Types ----------------------
export type BookingStatus = "REQUEST" | "ONGOING" | "SUCCESS" | "CANCEL";

interface BookingItem {
  id: string;
  kind: "VEHICLE" | "FACILITY" | "EQUIPMENT";
  resourceId: string;
  resourceName: string;
  start: string; // ISO
  end: string; // ISO
  quantity?: number; // for equipment
  status: BookingStatus;
}

// ---------------------- Main Component ----------------------
export default function MMCMResourceBookingApp() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("vehicles");
  const [openSheet, setOpenSheet] = useState(false);
  const [prefill, setPrefill] = useState<{ kind: "VEHICLE" | "FACILITY" | "EQUIPMENT"; id: string; name: string } | null>(null);

  // My Bookings (mock)
  const [bookings, setBookings] = useState<BookingItem[]>([
    {
      id: "b-001",
      kind: "VEHICLE",
      resourceId: "veh-2",
      resourceName: "Car 2",
      start: new Date().toISOString(),
      end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: "REQUEST",
    },
  ]);

  const filteredVehicles = useMemo(() => {
    return VEHICLES.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()) || v.plate.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const filteredFacilities = useMemo(() => {
    return FACILITIES.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const equipmentFlat = useMemo(() => {
    const rows: { id: string; name: string; total: number; available: number }[] = [];
    Object.entries(EQUIPMENT).forEach(([cat, groups]) => {
      Object.values(groups as any).forEach((arr: any) => {
        (arr as any[]).forEach((item) => rows.push(item));
      });
    });
    return rows.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  const startBooking = (kind: "VEHICLE" | "FACILITY" | "EQUIPMENT", id: string, name: string) => {
    setPrefill({ kind, id, name });
    setOpenSheet(true);
  };

  const createBooking = (payload: Partial<BookingItem> & { start: string; end: string; kind: BookingItem["kind"]; resourceId: string; resourceName: string; quantity?: number }) => {
    const newItem: BookingItem = {
      id: `b-${Math.random().toString(36).slice(2, 8)}`,
      kind: payload.kind,
      resourceId: payload.resourceId,
      resourceName: payload.resourceName,
      start: payload.start,
      end: payload.end,
      quantity: payload.quantity,
      status: "REQUEST",
    };
    setBookings((prev) => [newItem, ...prev]);
    setOpenSheet(false);
  };

  const updateStatus = (id: string, status: BookingStatus) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
            <Layers3 className="h-6 w-6" />
            <span className="font-semibold">MMCM Resource Booking</span>
          </motion.div>
          <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vehicles, rooms, equipment…" className="pl-9" />
            </div>
            <Button variant="outline" className="hidden sm:inline-flex"><Filter className="h-4 w-4 mr-2"/>Filters</Button>
            <Button onClick={() => setOpenSheet(true)} className="gap-2"><Plus className="h-4 w-4"/> New Booking</Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-3 gap-6">
        {/* Left: Resources */}
        <section className="lg:col-span-2">
          <SectionHeader icon={ClipboardList} title="Resources" subtitle="Vehicles, Facilities, and Equipment available on campus" />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
              <TabsTrigger value="vehicles" className="gap-2"><Car className="h-4 w-4"/>Vehicles</TabsTrigger>
              <TabsTrigger value="facilities" className="gap-2"><Building2 className="h-4 w-4"/>Facilities</TabsTrigger>
              <TabsTrigger value="equipment" className="gap-2"><Monitor className="h-4 w-4"/>Equipment</TabsTrigger>
            </TabsList>

            <TabsContent value="vehicles" className="mt-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredVehicles.map((v) => (
                  <Card key={v.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{v.name}</h3>
                          <p className="text-sm text-muted-foreground">Plate: {v.plate} • Seats: {v.seats}</p>
                        </div>
                        <Badge className={cn("border-none", STATUS_COLORS[v.status as keyof typeof STATUS_COLORS])}>{v.status}</Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("VEHICLE", v.id, v.name)}><CalendarIcon className="h-4 w-4 mr-2"/>Book</Button>
                        <Button variant="outline" size="sm" className="gap-2"><QrCode className="h-4 w-4"/>View QR</Button>
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
                          <p className="text-sm text-muted-foreground">Capacity & details — TBD</p>
                        </div>
                        <Badge className={cn("border-none", STATUS_COLORS[f.status as keyof typeof STATUS_COLORS])}>{f.status}</Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("FACILITY", f.id, f.name)}><CalendarIcon className="h-4 w-4 mr-2"/>Book</Button>
                        <Button variant="outline" size="sm" className="gap-2">Details <ChevronRight className="h-4 w-4"/></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="equipment" className="mt-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {equipmentFlat.map((e) => (
                  <Card key={e.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <h3 className="font-medium">{e.name}</h3>
                      <p className="text-sm text-muted-foreground">Available: {e.available} / {e.total}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <Button size="sm" onClick={() => startBooking("EQUIPMENT", e.id, e.name)}><CalendarIcon className="h-4 w-4 mr-2"/>Book</Button>
                        <Button variant="outline" size="sm" className="gap-2">Reserve</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: My Bookings & Status Tabs */}
        <section className="lg:col-span-1">
          <SectionHeader icon={Clock4} title="My Bookings" subtitle="Track Request → Ongoing → Success → Cancel" />
          <Tabs defaultValue="REQUEST" className="mt-4">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="REQUEST">Request</TabsTrigger>
              <TabsTrigger value="ONGOING">Ongoing</TabsTrigger>
              <TabsTrigger value="SUCCESS">Success</TabsTrigger>
              <TabsTrigger value="CANCEL">Cancel</TabsTrigger>
            </TabsList>

            {["REQUEST", "ONGOING", "SUCCESS", "CANCEL"].map((status) => (
              <TabsContent key={status} value={status} className="mt-4 space-y-3">
                {bookings.filter((b) => b.status === status).length === 0 && (
                  <Card><CardContent className="p-4 text-sm text-muted-foreground">No {status.toLowerCase()} bookings.</CardContent></Card>
                )}
                {bookings
                  .filter((b) => b.status === status)
                  .map((b) => (
                    <Card key={b.id} className="hover:shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{b.resourceName} <span className="text-muted-foreground">({b.kind})</span></p>
                            <p className="text-xs text-muted-foreground">{new Date(b.start).toLocaleString()} — {new Date(b.end).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === "REQUEST" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateStatus(b.id, "CANCEL")}><XCircle className="h-4 w-4 mr-1"/>Cancel</Button>
                                <Button size="sm" onClick={() => updateStatus(b.id, "ONGOING")}><QrCode className="h-4 w-4 mr-1"/>Start (Scan)</Button>
                              </>
                            )}
                            {status === "ONGOING" && (
                              <Button size="sm" onClick={() => updateStatus(b.id, "SUCCESS")}><CheckCircle2 className="h-4 w-4 mr-1"/>Finish</Button>
                            )}
                            {status === "SUCCESS" && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-1"/>Slip</Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Booking Slip (Preview)</DialogTitle>
                                    <DialogDescription>Printable trip ticket / handover slip will be generated here.</DialogDescription>
                                  </DialogHeader>
                                  <div className="text-sm">
                                    <p><strong>ID:</strong> {b.id}</p>
                                    <p><strong>Resource:</strong> {b.resourceName}</p>
                                    <p><strong>When:</strong> {new Date(b.start).toLocaleString()} — {new Date(b.end).toLocaleString()}</p>
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

      {/* Booking Sheet */}
      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5"/> New Booking</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resource Type</Label>
                <Select defaultValue={prefill?.kind ?? "VEHICLE"} onValueChange={(v) => {
                  if (prefill) setPrefill({ ...prefill, kind: v as any });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VEHICLE">Vehicle</SelectItem>
                    <SelectItem value="FACILITY">Facility</SelectItem>
                    <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resource</Label>
                <Input value={prefill?.name ?? ""} onChange={(e) => setPrefill(prefill ? { ...prefill, name: e.target.value } : null)} placeholder="Select or type resource" />
                <p className="text-xs text-muted-foreground">Prefilled from card — replace if needed.</p>
              </div>
            </div>

            {/* Time */}
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

            {/* Quantity (for Equipment) */}
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

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenSheet(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const startEl = (document.getElementById("start-dt") as HTMLInputElement);
                  const endEl = (document.getElementById("end-dt") as HTMLInputElement);
                  const qtyEl = (document.getElementById("qty") as HTMLInputElement | null);
                  const purposeEl = (document.getElementById("purpose") as HTMLInputElement);

                  if (!startEl?.value || !endEl?.value) {
                    alert("Please set start and end.");
                    return;
                  }

                  createBooking({
                    kind: (prefill?.kind ?? "VEHICLE") as any,
                    resourceId: prefill?.id ?? "manual",
                    resourceName: prefill?.name ?? "Manual Resource",
                    start: new Date(startEl.value).toISOString(),
                    end: new Date(endEl.value).toISOString(),
                    quantity: prefill?.kind === "EQUIPMENT" ? Number(qtyEl?.value || 1) : undefined,
                  });
                }}
              >
                Submit Request
              </Button>
            </div>

            <div className="border-t pt-4 text-xs text-muted-foreground">
              <p>Workflow preview: <strong>REQUEST</strong> → <strong>ONGOING</strong> (scan QR at pickup) → <strong>SUCCESS</strong> (scan at return) or <strong>CANCEL</strong>.</p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Footer */}
      <footer className="mt-10 py-10 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
          <span>Local-Hosted MMCM Resource Booking • Frontend MVP</span>
          <span>Statuses: REQUEST • ONGOING • SUCCESS • CANCEL</span>
        </div>
      </footer>
    </div>
  );
}
