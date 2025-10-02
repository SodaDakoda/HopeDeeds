const { Pool } = require("pg");
// Connect using the DATABASE_URL environment variable you just set.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "CRITICAL: DATABASE_URL environment variable is not set. Cannot connect to PostgreSQL."
  );
  // Exit the process if the essential connection string is missing
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  // Required configuration for cloud services like Neon
  ssl: {
    rejectUnauthorized: false,
  },
});

// Function to ensure the volunteer table exists
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

/**
 * Inserts a new volunteer record into the database.
 * @param {object} data - Volunteer registration data.
 * @returns {Promise<number>} The ID of the inserted record.
 */
const saveVolunteer = async (data) => {
  const sql = `
        INSERT INTO volunteers (
            full_name, email, phone, birthdate, zipcode, emergency_contact, 
            waiver_agreed, waiver_agreed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id;
    `;

  // We expect waiver_agreed to be 'true' or 'false' from the form submission
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
    throw err; // Re-throw the error for server.js to catch (e.g., unique email constraint)
  }
};

/**
 * Retrieves a volunteer's profile based on their email address.
 * @param {string} email - The volunteer's email address.
 * @returns {Promise<object | null>} The volunteer object or null if not found.
 */
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

// Initialize the database connection and table on import
initializeDatabase();

module.exports = {
  saveVolunteer,
  getVolunteerByEmail,
};
