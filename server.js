require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 8080;

// --- Database connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Middleware setup ---
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//
// ---------------------- VOLUNTEER ROUTES ----------------------
//

// Volunteer Registration
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
  if (missing.length > 0)
    return res.status(400).send(`Missing fields: ${missing.join(", ")}`);

  try {
    const query = `
      INSERT INTO volunteers (full_name, email, phone, birthdate, zipcode, emergency_contact, waiver_agreed, waiver_agreed_at, password)
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
    if (decoded === password) {
      return res.redirect(`/dashboard.html?email=${encodeURIComponent(email)}`);
    } else {
      return res.status(401).send("Invalid email or password.");
    }
  } catch (err) {
    console.error("Volunteer login error:", err);
    res.status(500).send("Server error during login.");
  }
});

//
// ---------------------- ORGANIZATION ROUTES ----------------------
//

// Serve Organization Login Page
app.get("/org-login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "org-login.html"));
});

// Serve Organization Registration Page
app.get("/org-register.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "org-register.html"));
});

// Organization Registration
app.post("/org/register", async (req, res) => {
  const data = req.body;
  const required = ["org_name", "email", "password"];
  const missing = required.filter((f) => !data[f]);
  if (missing.length > 0)
    return res.status(400).send(`Missing fields: ${missing.join(", ")}`);

  try {
    const query = `
      INSERT INTO organizations (org_name, email, phone, address, city, state, zipcode, contact_person, password)
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
    if (decoded === password) {
      return res.redirect(
        `/org-dashboard.html?email=${encodeURIComponent(email)}`
      );
    } else {
      return res.status(401).send("Invalid email or password.");
    }
  } catch (err) {
    console.error("Organization login error:", err);
    res.status(500).send("Server error during organization login.");
  }
});

//
// ---------------------- API ROUTES ----------------------
//

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

//
// ---------------------- DEFAULT ROUTES ----------------------
//
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ HopeDeeds Server running at http://localhost:${PORT}`);
});
