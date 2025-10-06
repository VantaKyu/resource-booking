import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, bootstrap } from "./db.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5174;

// ---- CORS: allow localhost + 127.0.0.1; allow x-demo-role for quick admin testing
const ALLOWED = (process.env.ORIGIN_LIST || "http://localhost:5173,http://127.0.0.1:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, ALLOWED.includes(origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","x-demo-role"], // ⬅ added x-demo-role
}));
app.options("*", cors());

app.use(express.json());

// --------------------------------------------------------
// Helper: very light role gate (swap with real auth/JWT later)
// Pass header: x-demo-role: ADMIN | STAFF | DRIVER | STUDENT
function requireRole(roles = []) {
  return (req, res, next) => {
    const role = String(req.headers["x-demo-role"] || "").toUpperCase();
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}
// --------------------------------------------------------

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// -------------------- RESOURCES -------------------------

// Public: list resources (existing)
app.get("/api/resources", async (req, res) => {
  try {
    const { kind } = req.query;
    const q = kind
      ? `SELECT * FROM resources WHERE kind = $1 ORDER BY name`
      : `SELECT * FROM resources ORDER BY kind, name`;
    const params = kind ? [String(kind).toUpperCase()] : [];
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/resources", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin/Staff: create resource
app.post("/api/resources", requireRole(["ADMIN","STAFF"]), async (req, res) => {
  try {
    const { kind, name, subcategory, type, quantity = 1, status = "Available" } = req.body || {};
    if (!kind || !name) return res.status(400).json({ error: "kind and name are required" });
    if (quantity < 0) return res.status(400).json({ error: "quantity must be >= 0" });
    if (!["Available","Maintenance","Inactive"].includes(status)) {
      return res.status(400).json({ error: "invalid status" });
    }

    const { rows } = await pool.query(
      `INSERT INTO resources (kind, name, subcategory, type, quantity, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, kind, name, subcategory, type, quantity, status`,
      [String(kind).toUpperCase(), name, subcategory ?? null, type ?? null, quantity, status]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Duplicate resource name for this kind" });
    console.error("POST /api/resources", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin/Staff: update resource (name, subcategory, type, quantity, status)
app.patch("/api/resources/:id", requireRole(["ADMIN","STAFF"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });

    const allowed = ["name","subcategory","type","quantity","status"];
    const input = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    if (Object.keys(input).length === 0) return res.status(400).json({ error: "no fields to update" });
    if ("quantity" in input && input.quantity < 0) return res.status(400).json({ error: "quantity must be >= 0" });
    if ("status" in input && !["Available","Maintenance","Inactive"].includes(input.status)) {
      return res.status(400).json({ error: "invalid status" });
    }

    const fields = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(input)) {
      fields.push(`${k} = $${i++}`);
      vals.push(v);
    }
    vals.push(id);

    const { rows } = await pool.query(
      `UPDATE resources SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING id, kind, name, subcategory, type, quantity, status`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Duplicate resource name for this kind" });
    console.error("PATCH /api/resources/:id", e);
    res.status(500).json({ error: "Server error" });
  }
});

// Admin/Staff: soft delete resource (set status = Inactive)
app.delete("/api/resources/:id", requireRole(["ADMIN","STAFF"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
    const { rowCount } = await pool.query(
      `UPDATE resources SET status = 'Inactive', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /api/resources/:id", e);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- BOOKINGS -------------------------

app.get("/api/bookings", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM bookings ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/bookings", e);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Create booking with overlap protection.
 * Denies if any REQUEST/ONGOING booking overlaps the requested time
 * for the same (kind, resource_id).
 */
app.post("/api/bookings", async (req, res) => {
  try {
    const {
      kind,
      resource_id,
      resource_name,
      start_dt,
      end_dt,
      quantity,
      requester_name,
      requester_role,
      purpose
    } = req.body;

    // Basic validation
    if (!kind || !resource_id || !resource_name || !start_dt || !end_dt) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const start = new Date(start_dt);
    const end = new Date(end_dt);
    if (!(start instanceof Date && !isNaN(start)) || !(end instanceof Date && !isNaN(end))) {
      return res.status(400).json({ error: "Invalid datetime format" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    // Conflict check
    const conflictSql = `
      SELECT 1
      FROM bookings
      WHERE kind = $1
        AND resource_id = $2
        AND status IN ('REQUEST', 'ONGOING')
        AND NOT ($4 <= start_dt OR $3 >= end_dt)
      LIMIT 1;
    `;
    const conflict = await pool.query(conflictSql, [
      String(kind).toUpperCase(),
      Number(resource_id),
      start.toISOString(),
      end.toISOString(),
    ]);

    if (conflict.rowCount > 0) {
      return res.status(409).json({
        error: "CONFLICT",
        message: "That resource is already booked for this time window. Please choose another time.",
      });
    }

    // Create booking
    const ins = await pool.query(
      `INSERT INTO bookings
       (kind, resource_id, resource_name, start_dt, end_dt, quantity, status, requester_name, requester_role, purpose, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'REQUEST',$7,$8,$9,NOW(),NOW())
       RETURNING *;`,
      [
        String(kind).toUpperCase(),
        Number(resource_id),
        resource_name,
        start.toISOString(),
        end.toISOString(),
        quantity || null,
        requester_name || null,
        requester_role || null,
        purpose || null
      ]
    );
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("POST /api/bookings error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Status transitions ---
app.post("/api/bookings/:id/start", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await pool.query(
      `UPDATE bookings
       SET status='ONGOING', started_at=NOW(), updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(upd.rows[0]);
  } catch (e) {
    console.error("POST /api/bookings/:id/start", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/bookings/:id/finish", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await pool.query(
      `UPDATE bookings
       SET status='SUCCESS', ended_at=NOW(), updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(upd.rows[0]);
  } catch (e) {
    console.error("POST /api/bookings/:id/finish", e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/bookings/:id/cancel", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const upd = await pool.query(
      `UPDATE bookings
       SET status='CANCEL', canceled_at=NOW(), updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json(upd.rows[0]);
  } catch (e) {
    console.error("POST /api/bookings/:id/cancel", e);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- START SERVER ---------------------

bootstrap().then(() => {
  const listenPort = PORT;
  app.listen(listenPort, () => {
    console.log(`API listening on http://localhost:${listenPort}`);
  });
}).catch((_e) => process.exit(1));
