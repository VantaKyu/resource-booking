import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, bootstrap } from "./db.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5174;

// CORS setup: allow localhost and 127.0.0.1 for Vite, handle preflight
const ALLOWED = (process.env.ORIGIN_LIST || "http://localhost:5173,http://127.0.0.1:5173").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, ALLOWED.includes(origin));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));
app.options("*", cors());

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bookings", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM bookings ORDER BY created_at DESC`);
    res.json(rows);
  } catch (e) {
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

    // Conflict check: overlap if NOT (newEnd <= existingStart OR newStart >= existingEnd)
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

    // No conflict -> create booking
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
    res.status(500).json({ error: "Server error" });
  }
});

bootstrap().then(() => {
  const listenPort = process.env.PORT || 5174;
  app.listen(listenPort, () => {
    console.log(`API listening on http://localhost:${listenPort}`);
  });
}).catch((_e) => process.exit(1));
