const { Pool } = require("pg");
// Connect using the DATABASE_URL environment variable
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "CRITICAL: DATABASE_URL environment variable is not set. Cannot connect to PostgreSQL."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Ensure the volunteer table exists
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    const createTableQuery = `
            CREATE TABLE IF NOT EXISTS volunteers (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(255) NOT NULL,
                birthdate DATE NOT NULL,
                zipcode VARCHAR(10),
                emergency_contact VARCHAR(255),
                waiver_agreed BOOLEAN NOT NULL,
                waiver_agreed_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
        `;
    await client.query(createTableQuery);
    client.release();
    console.log("PostgreSQL Volunteer table ready.");
  } catch (err) {
    console.error("Error initializing PostgreSQL table:", err.message);
  }
};

// Volunteer functions
const saveVolunteer = async (data) => {
  const sql = `
        INSERT INTO volunteers (
            full_name, email, phone, birthdate, zipcode, emergency_contact, 
            waiver_agreed, waiver_agreed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id;
    `;
  const waiverAgreedBool = data.waiver_agreed === "true";
  const timestamp = new Date().toISOString();

  const values = [
    data.full_name,
    data.email,
    data.phone,
    data.birthdate,
    data.zipcode || null,
    data.emergency_contact || null,
    waiverAgreedBool,
    timestamp,
  ];

  try {
    const res = await pool.query(sql, values);
    const newId = res.rows[0].id;
    console.log(`A new volunteer ID ${newId} has been registered.`);
    return newId;
  } catch (err) {
    console.error("Database insertion error:", err.message);
    throw err;
  }
};

const getVolunteerByEmail = async (email) => {
  const sql = `
        SELECT id, full_name, email, phone, birthdate, zipcode, emergency_contact, waiver_agreed, waiver_agreed_at, created_at
        FROM volunteers
        WHERE email = $1;
    `;
  try {
    const res = await pool.query(sql, [email]);
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (err) {
    console.error("Database retrieval error:", err.message);
    throw err;
  }
};

// --- Mock Volunteer Opportunities ---
const volunteerOpportunities = [
  {
    id: 1,
    title: "Community Kitchen Helper",
    description:
      "Assist with meal preparation and serving in the community kitchen.",
    area: "Kitchen",
    shift_time: "Wed, 9:00 AM - 12:00 PM",
  },
  {
    id: 2,
    title: "Neighborhood Cleanup",
    description:
      "Help clean up parks and public spaces in the local community.",
    area: "Outdoors",
    shift_time: "Sat, 10:00 AM - 2:00 PM",
  },
  {
    id: 3,
    title: "Administrative Support",
    description:
      "Assist with office tasks including data entry and volunteer coordination.",
    area: "Office",
    shift_time: "Mon, 1:00 PM - 4:00 PM",
  },
  {
    id: 4,
    title: "Youth Program Mentor",
    description: "Support and mentor children in after-school programs.",
    area: "Education",
    shift_time: "Tue, 3:00 PM - 6:00 PM",
  },
];

function getAllOpportunities() {
  return volunteerOpportunities;
}

// Initialize database on import
initializeDatabase();

module.exports = {
  saveVolunteer,
  getVolunteerByEmail,
  getAllOpportunities,
};
