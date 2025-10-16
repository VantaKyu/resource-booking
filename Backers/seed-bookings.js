import dotenv from "dotenv";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "mmcm_booking",
  user: process.env.PGUSER || "mmcm",
  password: process.env.PGPASSWORD || "",
  max: 10,
});

// Sample data
const requesters = [
  { name: "John Smith", role: "FACULTY" },
  { name: "Maria Santos", role: "STUDENT" },
  { name: "Admin Office", role: "STAFF" },
  { name: "Robert Chen", role: "FACULTY" },
  { name: "Anna Garcia", role: "STUDENT" },
  { name: "Michael Brown", role: "FACULTY" },
  { name: "Lisa Rodriguez", role: "STUDENT" },
  { name: "Department Head", role: "STAFF" },
  { name: "Sarah Johnson", role: "STUDENT" },
  { name: "David Lee", role: "FACULTY" },
  { name: "Emma Wilson", role: "STUDENT" },
  { name: "Student Council", role: "STUDENT" },
  { name: "Research Team", role: "FACULTY" },
  { name: "Facilities Office", role: "STAFF" },
];

const purposes = [
  "Department meeting",
  "Student activity",
  "Research presentation",
  "Workshop training",
  "Team building event",
  "Academic conference",
  "Seminar series",
  "Thesis defense",
  "Project collaboration",
  "Club meeting",
  "Guest lecture",
  "Laboratory experiment",
  "Skills training",
  "Community outreach",
  "Academic competition",
  "Faculty development",
  "Student orientation",
  "Board meeting",
];

// Utility functions
function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function setTimeOfDay(date, hour) {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday to Friday
}

// Generate random booking
function generateBooking(resource, daysOffset, statusWeights) {
  const requester = randomElement(requesters);
  const purpose = randomElement(purposes);
  
  // Generate date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let bookingDate = addDays(today, daysOffset);
  
  // Apply weekday bias - skip some weekend dates
  if (!isWeekday(bookingDate) && Math.random() < 0.5) {
    // 50% chance to skip weekend bookings
    return null;
  }
  
  // Random start time between 8 AM and 6 PM
  const startHour = randomInt(8, 18);
  const start_dt = setTimeOfDay(bookingDate, startHour);
  
  // Duration: 1-8 hours
  const duration = randomInt(1, 8);
  const end_dt = new Date(start_dt);
  end_dt.setHours(start_dt.getHours() + duration);
  
  // Determine status based on weights and date
  let status;
  const rand = Math.random();
  const isPast = daysOffset < -1;
  const isFuture = daysOffset > 0;
  
  if (isPast) {
    // Past bookings are mostly SUCCESS or CANCEL
    status = rand < 0.75 ? "SUCCESS" : "CANCEL";
  } else if (isFuture) {
    // Future bookings are REQUEST
    status = "REQUEST";
  } else {
    // Recent (last 2 days) can be any status
    if (rand < statusWeights.REQUEST) status = "REQUEST";
    else if (rand < statusWeights.REQUEST + statusWeights.ONGOING) status = "ONGOING";
    else if (rand < statusWeights.REQUEST + statusWeights.ONGOING + statusWeights.SUCCESS) status = "SUCCESS";
    else status = "CANCEL";
  }
  
  // Quantity logic
  let quantity = 1;
  if (resource.kind === "EQUIPMENT") {
    quantity = randomInt(1, Math.min(10, Math.floor(resource.quantity * 0.3)));
  }
  
  return {
    kind: resource.kind,
    resource_id: resource.id,
    resource_name: resource.name,
    start_dt: start_dt.toISOString(),
    end_dt: end_dt.toISOString(),
    quantity,
    status,
    requester_name: requester.name,
    requester_role: requester.role,
    purpose,
  };
}

async function seedBookings(clear = false) {
  try {
    console.log("🌱 Starting mock booking generation...\n");
    
    // Optionally clear existing bookings
    if (clear) {
      console.log("🗑️  Clearing existing bookings...");
      const { rowCount } = await pool.query("DELETE FROM bookings");
      console.log(`   Deleted ${rowCount} existing bookings\n`);
    }
    
    // Fetch all resources
    console.log("📦 Fetching resources...");
    const { rows: resources } = await pool.query(
      "SELECT id, kind, name, quantity FROM resources WHERE status = 'Available'"
    );
    
    if (resources.length === 0) {
      console.log("❌ No available resources found. Please run the bootstrap first.");
      return;
    }
    
    console.log(`   Found ${resources.length} available resources\n`);
    
    // Status distribution weights
    const statusWeights = {
      REQUEST: 0.10,
      ONGOING: 0.15,
      SUCCESS: 0.60,
      CANCEL: 0.15,
    };
    
    const bookings = [];
    const stats = {
      REQUEST: 0,
      ONGOING: 0,
      SUCCESS: 0,
      CANCEL: 0,
      past: 0,
      recent: 0,
      future: 0,
    };
    
    // Generate past bookings (45 days ago to 2 days ago)
    console.log("📅 Generating past bookings (45 days ago to 2 days ago)...");
    const pastBookingsTarget = randomInt(70, 80);
    for (let i = 0; i < pastBookingsTarget; i++) {
      const daysOffset = randomInt(-45, -2);
      const resource = randomElement(resources);
      const booking = generateBooking(resource, daysOffset, statusWeights);
      
      if (booking) {
        bookings.push(booking);
        stats[booking.status]++;
        stats.past++;
      }
    }
    
    // Generate recent/future bookings (last 2 days + next 7 days)
    console.log("📅 Generating recent and future bookings...");
    const recentFutureTarget = randomInt(20, 30);
    for (let i = 0; i < recentFutureTarget; i++) {
      const daysOffset = randomInt(-1, 7);
      const resource = randomElement(resources);
      const booking = generateBooking(resource, daysOffset, statusWeights);
      
      if (booking) {
        bookings.push(booking);
        stats[booking.status]++;
        if (daysOffset < 0) stats.recent++;
        else stats.future++;
      }
    }
    
    // Add some clustered bookings for "busy" patterns
    console.log("📊 Adding clustered bookings for busy patterns...");
    const busyDays = [-10, -8, -3]; // Specific busy days in the past
    for (const day of busyDays) {
      const clusterSize = randomInt(5, 8);
      for (let i = 0; i < clusterSize; i++) {
        const resource = randomElement(resources);
        const booking = generateBooking(resource, day, statusWeights);
        
        if (booking) {
          bookings.push(booking);
          stats[booking.status]++;
          stats.past++;
        }
      }
    }
    
    console.log(`   Generated ${bookings.length} total bookings\n`);
    
    // Insert bookings into database
    console.log("💾 Inserting bookings into database...");
    let inserted = 0;
    let skipped = 0;
    
    for (const booking of bookings) {
      try {
        await pool.query(
          `INSERT INTO bookings
           (kind, resource_id, resource_name, start_dt, end_dt, quantity, status, 
            requester_name, requester_role, purpose, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            booking.kind,
            booking.resource_id,
            booking.resource_name,
            booking.start_dt,
            booking.end_dt,
            booking.quantity,
            booking.status,
            booking.requester_name,
            booking.requester_role,
            booking.purpose,
          ]
        );
        inserted++;
      } catch (e) {
        // Skip conflicts (overlapping bookings)
        if (e.code === "23505" || e.message.includes("CONFLICT")) {
          skipped++;
        } else {
          console.error("Error inserting booking:", e.message);
        }
      }
    }
    
    console.log(`   ✅ Inserted: ${inserted} bookings`);
    if (skipped > 0) {
      console.log(`   ⏭️  Skipped: ${skipped} (conflicts)`);
    }
    
    // Display summary
    console.log("\n📊 Summary:");
    console.log("═══════════════════════════════════════");
    console.log(`Total bookings created: ${inserted}`);
    console.log("\nBy Status:");
    console.log(`  REQUEST:  ${stats.REQUEST}`);
    console.log(`  ONGOING:  ${stats.ONGOING}`);
    console.log(`  SUCCESS:  ${stats.SUCCESS}`);
    console.log(`  CANCEL:   ${stats.CANCEL}`);
    console.log("\nBy Time Period:");
    console.log(`  Past (45 days ago - 2 days ago): ${stats.past}`);
    console.log(`  Recent (last 2 days): ${stats.recent}`);
    console.log(`  Future (next 7 days): ${stats.future}`);
    console.log("═══════════════════════════════════════");
    console.log("\n✨ Mock booking generation complete!");
    console.log("🚀 You can now view the populated dashboard.\n");
    
  } catch (error) {
    console.error("❌ Error during seed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");

// Run the seeder
seedBookings(shouldClear).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

