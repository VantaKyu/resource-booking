// Backers/routes/resources.js
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// GET /api/resources?kind=VEHICLE|FACILITY|EQUIPMENT (public)
router.get("/", async (req, res) => {
  const { kind } = req.query;
  const args = [];
  let where = "";
  if (kind) { where = "WHERE kind = $1"; args.push(kind.toUpperCase()); }

  const q = `
    SELECT id, kind, name,
           COALESCE(subcategory,'') AS subcategory,
           COALESCE(type,'') AS type,
           quantity, status
    FROM resources
    ${where}
    ORDER BY kind, name;
  `;
  const { rows } = await pool.query(q, args);
  res.json(rows);
});

// --- Helper: basic role gate (replace with your real auth later) ---
const ALLOWED_ROLES = ["ADMIN", "STAFF"];
function requireRole(roles) {
  return (req, res, next) => {
    const role = String(req.headers["x-demo-role"] || "").toUpperCase();

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(403).json({ error: "Forbidden: role not allowed" });
    }
    if (!roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// POST /api/resources  (Admin/Staff)
router.post("/", requireRole(["ADMIN", "STAFF"]), async (req, res) => {
  const { kind, name, subcategory, type, quantity = 1, status = "Available" } = req.body || {};
  if (!kind || !name) return res.status(400).json({ error: "kind and name are required" });
  if (quantity < 0) return res.status(400).json({ error: "quantity must be >= 0" });
  if (!["Available","Maintenance","Inactive"].includes(status)) {
    return res.status(400).json({ error: "invalid status" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO resources (kind, name, subcategory, type, quantity, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, kind, name, subcategory, type, quantity, status`,
      [String(kind).toUpperCase(), name, subcategory ?? null, type ?? null, quantity, status]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Duplicate resource name for this kind" });
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/resources/:id  (Admin/Staff)
router.patch("/:id", requireRole(["ADMIN", "STAFF"]), async (req, res) => {
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

  try {
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
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/resources/:id  (Admin/Staff) — soft delete
router.delete("/:id", requireRole(["ADMIN","STAFF"]), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "invalid id" });
  const { rowCount } = await pool.query(
    `UPDATE resources SET status = 'Inactive', updated_at = NOW() WHERE id = $1`,
    [id]
  );
  if (!rowCount) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

export default router;
