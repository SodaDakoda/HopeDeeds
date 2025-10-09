require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const moment = require("moment");

const app = express();
const PORT = process.env.PORT || 8080;

// ---------------------- DATABASE CONNECTION ----------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// ---------------------- MIDDLEWARE ----------------------
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---------------------- VOLUNTEER ROUTES ----------------------

// Register Volunteer
app.post("/register", async (req, res) => {
  const data = req.body;
  const required = [
    "full_name",
    "email",
    "phone",
    "birthdate",
    "waiver_agreed",
    "password",
  ];
  const missing = required.filter((f) => !data[f]);
  if (missing.length)
    return res.status(400).send(`Missing fields: ${missing.join(", ")}`);

  try {
    const query = `
      INSERT INTO volunteers
        (full_name, email, phone, birthdate, zipcode, emergency_contact, waiver_agreed, waiver_agreed_at, password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)
      RETURNING id
    `;
    await pool.query(query, [
      data.full_name,
      data.email,
      data.phone,
      data.birthdate,
      data.zipcode || "",
      data.emergency_contact || "",
      data.waiver_agreed,
      Buffer.from(data.password).toString("base64"),
    ]);
    res.redirect(`/dashboard.html?email=${encodeURIComponent(data.email)}`);
  } catch (err) {
    console.error("Volunteer registration error:", err);
    if (err.code === "23505")
      return res.status(400).send("Email already registered.");
    res.status(500).send("Server error during registration.");
  }
});

// Volunteer Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send("Email and password required.");

  try {
    const result = await pool.query(
      "SELECT password FROM volunteers WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) return res.status(401).send("Invalid login.");
    const decoded = Buffer.from(result.rows[0].password, "base64").toString(
      "utf-8"
    );
    if (decoded === password)
      return res.redirect(`/dashboard.html?email=${encodeURIComponent(email)}`);
    res.status(401).send("Invalid email or password.");
  } catch (err) {
    console.error("Volunteer login error:", err);
    res.status(500).send("Server error during login.");
  }
});

// Get Volunteer Info
app.get("/api/volunteer/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const result = await pool.query(
      "SELECT * FROM volunteers WHERE email = $1",
      [email]
    );
    const volunteer = result.rows[0];
    if (!volunteer)
      return res.status(404).json({ error: "Volunteer not found" });
    delete volunteer.password;
    res.json(volunteer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch volunteer" });
  }
});

// ---------------------- ORGANIZATION ROUTES ----------------------

// Serve login/register pages
app.get("/org-login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-login.html"))
);
app.get("/org-register.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-register.html"))
);

// Organization Registration
app.post("/org/register", async (req, res) => {
  const data = req.body;
  const required = ["org_name", "email", "password"];
  const missing = required.filter((f) => !data[f]);
  if (missing.length)
    return res.status(400).send(`Missing fields: ${missing.join(", ")}`);

  try {
    const query = `
      INSERT INTO organizations
        (org_name, email, phone, address, city, state, zipcode, contact_person, password)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id
    `;
    await pool.query(query, [
      data.org_name,
      data.email,
      data.phone || "",
      data.address || "",
      data.city || "",
      data.state || "",
      data.zipcode || "",
      data.contact_person || "",
      Buffer.from(data.password).toString("base64"),
    ]);
    res.redirect(`/org-dashboard.html?email=${encodeURIComponent(data.email)}`);
  } catch (err) {
    console.error("Organization registration error:", err);
    if (err.code === "23505")
      return res.status(400).send("Email already registered.");
    res.status(500).send("Server error during organization registration.");
  }
});

// Organization Login
app.post("/org/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send("Email and password required.");

  try {
    const result = await pool.query(
      "SELECT password FROM organizations WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0)
      return res.status(401).send("Invalid organization login.");
    const decoded = Buffer.from(result.rows[0].password, "base64").toString(
      "utf-8"
    );
    if (decoded === password)
      return res.redirect(
        `/org-dashboard.html?email=${encodeURIComponent(email)}`
      );
    res.status(401).send("Invalid email or password.");
  } catch (err) {
    console.error("Organization login error:", err);
    res.status(500).send("Server error during organization login.");
  }
});

// Get Organization Info
app.get("/api/organization/:email", async (req, res) => {
  const email = req.params.email;
  try {
    const result = await pool.query(
      "SELECT * FROM organizations WHERE email = $1",
      [email]
    );
    const org = result.rows[0];
    if (!org) return res.status(404).json({ error: "Organization not found" });
    delete org.password;
    res.json(org);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

// ---------------------- OPPORTUNITY ROUTES ----------------------

// Recurrence generation helper
function generateRecurring(opportunity, parentId) {
  const instances = [];
  const rule = opportunity.recurrence_rule;
  if (!rule) return instances;

  const today = moment(opportunity.start_date);
  const end = moment().add(3, "months");

  let current = today.clone();
  while (current.isBefore(end)) {
    if (rule.type === "weekly" && rule.days.includes(current.format("ddd"))) {
      instances.push({
        org_id: opportunity.org_id,
        title: opportunity.title,
        description: opportunity.description,
        start_date: current.format("YYYY-MM-DD"),
        time: opportunity.time,
        duration: opportunity.duration || "1h",
        recurrence_rule: JSON.stringify(rule),
        parent_id: parentId,
        status: "active",
      });
    }
    current.add(1, "day");
  }
  return instances;
}

// Get all opportunities for an org
app.get("/api/org/:email/opportunities", async (req, res) => {
  const email = req.params.email;
  try {
    const orgResult = await pool.query(
      "SELECT id FROM organizations WHERE email = $1",
      [email]
    );
    if (!orgResult.rows.length)
      return res.status(404).json({ error: "Organization not found" });
    const orgId = orgResult.rows[0].id;

    const oppResult = await pool.query(
      "SELECT * FROM opportunities WHERE org_id = $1 ORDER BY start_date ASC, time ASC",
      [orgId]
    );
    res.json(oppResult.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// Add new opportunity
app.post("/api/org/:email/opportunities", async (req, res) => {
  const email = req.params.email;
  const { title, date, time, description, duration, recurrence_rule } =
    req.body;
  if (!title || !date || !time || !description)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const orgResult = await pool.query(
      "SELECT id FROM organizations WHERE email = $1",
      [email]
    );
    if (!orgResult.rows.length)
      return res.status(404).json({ error: "Organization not found" });
    const orgId = orgResult.rows[0].id;

    const insertQuery = `
      INSERT INTO opportunities (org_id, title, start_date, time, description, duration, recurrence_rule)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const insertResult = await pool.query(insertQuery, [
      orgId,
      title,
      date,
      time,
      description,
      duration || "1h",
      recurrence_rule ? JSON.stringify(recurrence_rule) : null,
    ]);
    const parentId = insertResult.rows[0].id;

    // Generate recurring instances
    if (recurrence_rule) {
      const recurringInstances = generateRecurring(
        {
          org_id: orgId,
          title,
          description,
          start_date: date,
          time,
          duration,
          recurrence_rule,
        },
        parentId
      );
      for (let instance of recurringInstances) {
        await pool.query(
          `
          INSERT INTO opportunities (org_id, title, start_date, time, description, duration, recurrence_rule, parent_id, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
          [
            instance.org_id,
            instance.title,
            instance.start_date,
            instance.time,
            instance.description,
            instance.duration,
            instance.recurrence_rule,
            instance.parent_id,
            instance.status,
          ]
        );
      }
    }

    res.status(201).json({ message: "Opportunity created", id: parentId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add opportunity" });
  }
});

// Get upcoming opportunities for volunteers
app.get("/api/opportunities", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM opportunities WHERE start_date >= CURRENT_DATE AND status = 'active' ORDER BY start_date ASC, time ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch volunteer opportunities" });
  }
});

// ---------------------- DEFAULT ROUTES ----------------------
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log(`✅ HopeDeeds Server running at http://localhost:${PORT}`);
});
