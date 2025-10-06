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
    -- VEHICLES
    ('VEHICLE','Car 1','Vehicle','Sedan',1,'Available'),
    ('VEHICLE','Car 2','Vehicle','Sedan',1,'Available'),
    ('VEHICLE','Car 3','Vehicle','MPV',1,'Maintenance'),
    ('VEHICLE','Car 4','Vehicle','Sedan',1,'Booked'),
    ('VEHICLE','Car 5','Vehicle','Sedan',1,'Available'),

    -- FACILITIES
    ('FACILITY','Lecture Room','Classroom','Lecture Room',1,'Under Maintenance'),
    ('FACILITY','Drawing Room','Classroom','Drawing Room',1,'Available'),
    ('FACILITY','Computer Lab','Lab','Computer Lab',1,'Available'),
    ('FACILITY','Chemistry Lab','Lab','Chemistry Lab',1,'Available'),
    ('FACILITY','Engineering Lab','Lab','Engineering Lab',1,'Available'),
    ('FACILITY','Auditorium 1','Auditorium','Auditorium 1',1,'Available'),
    ('FACILITY','Auditorium 2','Auditorium','Auditorium 2',1,'Under Maintenance'),
    ('FACILITY','Auditorium 3','Auditorium','Auditorium 3',1,'Available'),
    ('FACILITY','Drawing Lab 3','Lab','Drawing Lab',1,'Available'),
    ('FACILITY','Plaza','Outdoor','Plaza',1,'Available'),
    ('FACILITY','Playcourt 1','Court','Playcourt',1,'Available'),
    ('FACILITY','Playcourt 2','Court','Playcourt',1,'Available'),
    ('FACILITY','Playcourt 3','Court','Playcourt',1,'Under Maintenance'),
    ('FACILITY','Playcourt 4','Court','Playcourt',1,'Available'),
    ('FACILITY','Volleyball Court','Court','Volleyball',1,'Available'),
    ('FACILITY','Futsal Court','Court','Futsal',1,'Available'),

    -- EQUIPMENT - FURNITURE
    ('EQUIPMENT','Chair – Rabami','Furniture','Chair',50,'Available'),
    ('EQUIPMENT','Chair – Monobloc','Furniture','Chair',100,'Available'),
    ('EQUIPMENT','Chair – Stool','Furniture','Chair',30,'Available'),
    ('EQUIPMENT','Table – Trapezoid','Furniture','Table',10,'Available'),
    ('EQUIPMENT','Table – Training (Long)','Furniture','Table',12,'Available'),
    ('EQUIPMENT','Table – Round (Small)','Furniture','Table',10,'Available'),
    ('EQUIPMENT','Table – Round (Big)','Furniture','Table',6,'Available'),
    ('EQUIPMENT','Table – Foldable (Small)','Furniture','Table',15,'Available'),
    ('EQUIPMENT','Table – Cocktail','Furniture','Table',8,'Available'),

    -- EQUIPMENT - AUDIO/VISUAL DEVICES
    ('EQUIPMENT','TV','A/V','TV',6,'Available'),
    ('EQUIPMENT','Computer – Windows','A/V','Computer',12,'Available'),
    ('EQUIPMENT','Computer – Mac','A/V','Computer',5,'Available'),
    ('EQUIPMENT','Projector','A/V','Projector',7,'Available'),

    -- EQUIPMENT - AUDIO
    ('EQUIPMENT','Microphone – Wired','A/V','Mic Wired',20,'Available'),
    ('EQUIPMENT','Microphone – Wireless','A/V','Mic Wireless',12,'Available'),
    ('EQUIPMENT','Portable Speaker – Small','A/V','Speaker',6,'Available'),
    ('EQUIPMENT','Portable Speaker – Big','A/V','Speaker',4,'Available'),

    -- EQUIPMENT - ACCESSORIES
    ('EQUIPMENT','Podium','Accessories','Podium',2,'Available'),
    ('EQUIPMENT','Flags','Accessories','Flags',10,'Available'),
    ('EQUIPMENT','Extension Wires','Accessories','Extension',20,'Available'),
    ('EQUIPMENT','Speaker Stand','Accessories','Speaker Stand',6,'Available'),
    ('EQUIPMENT','Microphone Stand','Accessories','Mic Stand',10,'Available'),
    ('EQUIPMENT','Mixer','Accessories','Mixer',3,'Available'),
    ('EQUIPMENT','Clicker','Accessories','Clicker',6,'Available'),

    -- EQUIPMENT - OTHERS
    ('EQUIPMENT','Manual Entry (Specify)','Others','Manual',999,'Available'),
    ('EQUIPMENT','Sports Equipment (Specify)','Others','Sports',999,'Available');
    `);
  }
}
