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
    const result = await query(
      `INSERT INTO shifts
       (title, area, start_date, start_time, end_time, duration, max_capacity,
        frequency_type, recurrence_rule, recur_until, special_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating shift:", err);
    res.status(500).json({ error: "Failed to create shift." });
  }
};
