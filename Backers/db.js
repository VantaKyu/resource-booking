import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config();

export const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "mmcm_booking",
  user: process.env.PGUSER || "mmcm",
  password: process.env.PGPASSWORD || "",
  max: 10,
});

export async function bootstrap() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL DEFAULT 'STUDENT',
      dept TEXT
    );

    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      subcategory TEXT,
      type TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Available'
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      resource_id INTEGER NOT NULL REFERENCES resources(id),
      resource_name TEXT NOT NULL,
      start_dt TIMESTAMPTZ NOT NULL,
      end_dt   TIMESTAMPTZ NOT NULL,
      quantity INTEGER,
      status TEXT NOT NULL CHECK (status IN ('REQUEST','ONGOING','SUCCESS','CANCEL')) DEFAULT 'REQUEST',
      requester_name TEXT,
      requester_role TEXT,
      purpose TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_resource_time
      ON bookings(resource_id, start_dt, end_dt);
  `);

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM resources;`);
  if (rows[0].c === 0) {
    await pool.query(`
      INSERT INTO resources (kind, name, subcategory, type, quantity, status) VALUES
        ('VEHICLE','Car 1','Vehicle','Sedan',1,'Available'),
        ('VEHICLE','Car 2','Vehicle','Sedan',1,'Available'),
        ('VEHICLE','Car 3','Vehicle','MPV',1,'Maintenance'),
        ('VEHICLE','Car 4','Vehicle','Sedan',1,'Booked'),
        ('VEHICLE','Car 5','Vehicle','Sedan',1,'Available'),
        ('FACILITY','Lecture Room','Classroom','Lecture Room',1,'Available'),
        ('FACILITY','Playcourt 1','Court','Playcourt',1,'Available'),
        ('FACILITY','Auditorium 1','Auditorium','Auditorium 1',1,'Available'),
        ('EQUIPMENT','Chair – Monobloc','Furniture','Chair',100,'Available'),
        ('EQUIPMENT','Projector','A/V','Projector',7,'Available'),
        ('EQUIPMENT','Microphone – Wireless','A/V','Mic Wireless',12,'Available');
    `);
  }
}
