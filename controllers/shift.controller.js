// controllers/shift.controller.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const createShift = async (req, res) => {
  const {
    title,
    area,
    start_date,
    start_time,
    end_time,
    duration,
    max_capacity,
    frequency_type,
    recurrence_rule,
    recur_until,
    special_type,
  } = req.body;

  if (!title || !start_date || !start_time)
    return res.status(400).json({ error: "Missing required fields." });

  try {
    const result = await pool.query(
      `INSERT INTO opportunities
       (title, area, start_date, start_time, end_time, duration, max_capacity,
        frequency_type, recurrence_rule, recur_until, special_type, org_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')
       RETURNING *`,
      [
        title,
        area || null,
        start_date,
        start_time,
        end_time || null,
        duration || null,
        max_capacity || 10,
        frequency_type || null,
        recurrence_rule || null,
        recur_until || null,
        special_type || null,
        4, // <-- hardcode org_id for testing (you said your org_id = 4)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating shift:", err);
    res.status(500).json({ error: "Failed to create shift." });
  }
};

const getShifts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, area, start_date, start_time, end_time, duration, max_capacity
       FROM opportunities
       WHERE status = 'active'
       ORDER BY start_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching shifts:", err);
    res.status(500).json({ error: "Failed to fetch shifts." });
  }
};

module.exports = { createShift, getShifts };
