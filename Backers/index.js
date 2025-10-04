import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool, bootstrap } from "./db.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5174;
const ORIGIN = process.env.ORIGIN || "http://localhost:5173";

app.use(cors({ origin: ORIGIN }));
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

app.post("/api/bookings", async (req, res) => {
  try {
    const { kind, resource_id, resource_name, start_dt, end_dt, quantity, requester_name, requester_role, purpose } = req.body;
    if (!kind || !resource_id || !resource_name || !start_dt || !end_dt) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const ins = await pool.query(
      `INSERT INTO bookings (kind, resource_id, resource_name, start_dt, end_dt, quantity, status, requester_name, requester_role, purpose, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'REQUEST',$7,$8,$9,NOW())
       RETURNING *;`,
      [kind, resource_id, resource_name, start_dt, end_dt, quantity || null, requester_name || null, requester_role || null, purpose || null]
    );
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

bootstrap().then(() => {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}).catch((e) => process.exit(1));
