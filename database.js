const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Ensure the volunteer table exists (added password column)
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
        password TEXT NOT NULL,
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

// Save volunteer with Base64 password
const saveVolunteer = async (data) => {
  const sql = `
    INSERT INTO volunteers (
      full_name, email, phone, birthdate, zipcode, emergency_contact, 
      waiver_agreed, waiver_agreed_at, password, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    RETURNING id;
  `;

  const waiverAgreedBool = data.waiver_agreed === "true";
  const timestamp = new Date().toISOString();

  // Base64 encode the password
  const encodedPassword = Buffer.from(data.password, "utf-8").toString(
    "base64"
  );

  const values = [
    data.full_name,
    data.email,
    data.phone,
    data.birthdate,
    data.zipcode || null,
    data.emergency_contact || null,
    waiverAgreedBool,
    timestamp,
    encodedPassword,
  ];

  try {
    const res = await pool.query(sql, values);
    console.log(`New volunteer registered: ID ${res.rows[0].id}`);
    return res.rows[0].id;
  } catch (err) {
    console.error("Database insertion error:", err.message);
    throw err;
  }
};

// Get volunteer by email
const getVolunteerByEmail = async (email) => {
  const sql = `
    SELECT id, full_name, email, phone, birthdate, zipcode, emergency_contact,
           waiver_agreed, waiver_agreed_at, password, created_at
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

// Verify email/password for login
const verifyCredentials = async (email, password) => {
  const volunteer = await getVolunteerByEmail(email);
  if (!volunteer) return false;

  const decodedPassword = Buffer.from(volunteer.password, "base64").toString(
    "utf-8"
  );
  return decodedPassword === password;
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

// Initialize DB
initializeDatabase();

module.exports = {
  saveVolunteer,
  getVolunteerByEmail,
  verifyCredentials,
  getAllOpportunities,
};
