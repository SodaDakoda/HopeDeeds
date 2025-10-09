const { query } = require("./database");

const createShift = async (req, res) => {
  const { title, date, time, location } = req.body;
  if (!title || !date || !time || !location) {
    return res.status(400).json({ error: "All fields are required." });
  }
  try {
    const result = await query(
      "INSERT INTO shifts (title, date, time, location) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, date, time, location]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shift." });
  }
};

const getShifts = async (req, res) => {
  try {
    const result = await query("SELECT * FROM shifts ORDER BY date ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shifts." });
  }
};

module.exports = { createShift, getShifts };
