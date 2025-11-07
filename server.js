require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

// ---------------------- DATABASE ----------------------
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

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: false,
    saveUninitialized: true,
  })
);

// ---------------------- ORGANIZATION ROUTES ----------------------

// Serve login/register pages
app.get("/org-login.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-login.html"))
);
app.get("/org-register.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-register.html"))
);

// Register new organization
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
      RETURNING id, email
    `;
    const result = await pool.query(query, [
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

    // Save session
    req.session.orgId = result.rows[0].id;
    req.session.orgEmail = result.rows[0].email;

    res.redirect("/organization_dashboard.html");
  } catch (err) {
    console.error("Organization registration error:", err);
    if (err.code === "23505")
      return res.status(400).send("Email already registered.");
    res.status(500).send("Server error during organization registration.");
  }
});

// Login
app.post("/org/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send("Email and password required.");

  try {
    const result = await pool.query(
      "SELECT id, password FROM organizations WHERE email = $1",
      [email]
    );
    if (!result.rows.length)
      return res.status(401).send("Invalid organization login.");

    const decoded = Buffer.from(result.rows[0].password, "base64").toString(
      "utf-8"
    );
    if (decoded !== password) return res.status(401).send("Invalid login.");

    req.session.orgId = result.rows[0].id;
    req.session.orgEmail = email;

    res.redirect("/organization_dashboard.html");
  } catch (err) {
    console.error("Organization login error:", err);
    res.status(500).send("Server error during organization login.");
  }
});

// Logout
app.get("/org/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Failed to destroy session:", err);
    res.redirect("/org-login.html");
  });
});

// Get organization profile
app.get("/api/organization", async (req, res) => {
  const orgId = req.session.orgId;
  if (!orgId) return res.status(401).json({ error: "Not logged in" });

  try {
    const result = await pool.query(
      "SELECT * FROM organizations WHERE id = $1",
      [orgId]
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

// List opportunities
app.get("/api/opportunities", async (req, res) => {
  const orgId = req.session.orgId;
  if (!orgId) return res.status(401).json({ error: "Not logged in" });

  try {
    const result = await pool.query(
      `SELECT id, title, area, start_date, start_time, end_time, duration, max_capacity,
              frequency_type, description, status
       FROM opportunities
       WHERE org_id = $1 AND status='active'
       ORDER BY start_date ASC, start_time ASC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching opportunities:", err);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// Create opportunity
app.post("/api/opportunities", async (req, res) => {
  const orgId = req.session.orgId;
  if (!orgId) return res.status(401).json({ error: "Not logged in" });

  const { title, start_date, time, duration, description } = req.body;
  if (!title || !start_date || !time || !duration || !description)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const query = `
      INSERT INTO opportunities
      (org_id, title, start_date, start_time, duration, description, status)
      VALUES ($1,$2,$3,$4,$5,$6,'active')
      RETURNING *
    `;
    const result = await pool.query(query, [
      orgId,
      title,
      start_date,
      time, // maps to start_time in DB
      duration,
      description,
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating opportunity:", err);
    res.status(500).json({ error: "Failed to create opportunity" });
  }
});

// Delete opportunity
app.delete("/api/opportunities/:id", async (req, res) => {
  const orgId = req.session.orgId;
  if (!orgId) return res.status(401).json({ error: "Not logged in" });

  const oppId = req.params.id;
  try {
    const result = await pool.query(
      "DELETE FROM opportunities WHERE id = $1 AND org_id = $2 RETURNING id",
      [oppId, orgId]
    );
    if (!result.rows.length)
      return res.status(404).json({ error: "Opportunity not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting opportunity:", err);
    res.status(500).json({ error: "Failed to delete opportunity" });
  }
});

// ---------------------- ADMIN ROUTES ----------------------
const { adminOnly } = require("./middleware/auth");
const { createShift, getShifts } = require("./controllers/shift.controller");

// Get all volunteers
app.get("/admin/volunteers", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, email, phone, zipcode, waiver_agreed, waiver_agreed_at, created_at
      FROM volunteers
      ORDER BY created_at DESC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching volunteers:", err);
    res.status(500).json({ error: "Failed to fetch volunteers." });
  }
});

// Create shift
app.post("/admin/shifts", adminOnly, createShift);

// Get shifts
app.get("/admin/shifts", adminOnly, getShifts);

// ---------------------- DEFAULT ROUTES ----------------------
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log(`✅ HopeDeeds Server running at http://localhost:${PORT}`);
});
