require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");
const moment = require("moment");
const helmet = require("helmet");

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

// ---------------------- CONTENT SECURITY POLICY ----------------------
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
      ],
      styleSrc: [
        "'self'",
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:", "https://hopedeeds.onrender.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"],
    },
  })
);

// ---------------------- VOLUNTEER ROUTES ----------------------
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

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send("Email and password required.");

  try {
    const result = await pool.query(
      "SELECT password FROM volunteers WHERE email = $1",
      [email]
    );
    if (!result.rows.length) return res.status(401).send("Invalid login.");
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
app.get("/organization_register.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-login.html"))
);
app.get("/organization_register.html", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "org-register.html"))
);

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
    res.redirect(
      `/organization_dashboard.html?email=${encodeURIComponent(data.email)}`
    );
  } catch (err) {
    console.error("Organization registration error:", err);
    if (err.code === "23505")
      return res.status(400).send("Email already registered.");
    res.status(500).send("Server error during organization registration.");
  }
});

app.post("/org/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).send("Email and password required.");

  try {
    const result = await pool.query(
      "SELECT password FROM organizations WHERE email = $1",
      [email]
    );
    if (!result.rows.length)
      return res.status(401).send("Invalid organization login.");
    const decoded = Buffer.from(result.rows[0].password, "base64").toString(
      "utf-8"
    );
    if (decoded === password)
      return res.redirect(
        `/organization_dashboard.html?email=${encodeURIComponent(email)}`
      );
    res.status(401).send("Invalid email or password.");
  } catch (err) {
    console.error("Organization login error:", err);
    res.status(500).send("Server error during organization login.");
  }
});

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
app.get("/api/opportunities", async (req, res) => {
  try {
    const { date, organization } = req.query;
    let query =
      "SELECT * FROM opportunities WHERE start_date >= CURRENT_DATE AND status='active'";
    const params = [];

    if (date) {
      params.push(date);
      query += ` AND start_date = $${params.length}`;
    }
    if (organization) {
      params.push(organization);
      query += ` AND org_id = $${params.length}`;
    }

    query += " ORDER BY start_date ASC, time ASC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch volunteer opportunities:", err);
    res.status(500).json({ error: "Failed to fetch volunteer opportunities" });
  }
});

app.post("/api/opportunities", async (req, res) => {
  const data = req.body;
  const required = [
    "org_id",
    "title",
    "description",
    "start_date",
    "time",
    "duration",
  ];
  const missing = required.filter((f) => !data[f]);
  if (missing.length)
    return res.status(400).send(`Missing fields: ${missing.join(", ")}`);

  try {
    const insertQuery = `
      INSERT INTO opportunities
      (org_id, title, description, start_date, time, duration, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      data.org_id,
      data.title,
      data.description,
      data.start_date,
      data.time,
      data.duration,
      data.status || "active",
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating opportunity:", err);
    res.status(500).send("Failed to create opportunity");
  }
});

app.delete("/api/opportunities/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM opportunities WHERE id = $1", [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error deleting opportunity:", err);
    res.status(500).json({ error: "Failed to delete opportunity" });
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
