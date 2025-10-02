const sqlite3 = require("sqlite3").verbose();
const DB_PATH = "./hopedeeds.db";

// Initialize the database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Could not connect to database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    // Create the volunteer table if it doesn't exist
    db.run(
      `CREATE TABLE IF NOT EXISTS volunteers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT NOT NULL,
            birthdate TEXT NOT NULL,
            zipcode TEXT,
            emergency_contact TEXT,
            waiver_agreed BOOLEAN NOT NULL,
            waiver_agreed_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )`,
      (err) => {
        if (err) {
          console.error("Error creating table:", err.message);
        } else {
          console.log("Volunteer table ready.");
        }
      }
    );
  }
});

/**
 * Inserts a new volunteer record into the database.
 * @param {object} data - Volunteer registration data.
 * @returns {Promise<number>} The ID of the inserted record.
 */
const saveVolunteer = (data) => {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO volunteers (
            full_name, email, phone, birthdate, zipcode, emergency_contact, 
            waiver_agreed, waiver_agreed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const timestamp = new Date().toISOString();

    // Prepare the values array
    const values = [
      data.full_name,
      data.email,
      data.phone,
      data.birthdate,
      data.zipcode || null,
      data.emergency_contact || null,
      data.waiver_agreed === "true" ? 1 : 0, // Convert boolean string to integer for SQLite
      timestamp, // waiver_agreed_at uses the current submission time
      timestamp, // created_at uses the current submission time
    ];

    db.run(sql, values, function (err) {
      if (err) {
        console.error("Database insertion error:", err.message);
        reject(new Error(`Database error: ${err.message}`));
      } else {
        console.log(`A new volunteer ID ${this.lastID} has been registered.`);
        resolve(this.lastID);
      }
    });
  });
};

module.exports = {
  db,
  saveVolunteer,
};
