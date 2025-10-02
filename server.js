const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
// Import both functions from the updated database.js
const { saveVolunteer, getVolunteerByEmail } = require("./database");

const app = express();
const PORT = 8080;

// Middleware setup
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Volunteer Registration POST Route ---
app.post("/register", async (req, res) => {
  const data = req.body;
  console.log("Received registration data:", data);

  const requiredFields = [
    "full_name",
    "email",
    "phone",
    "birthdate",
    "waiver_agreed",
  ];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    return res.status(400).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;">
                <h2>Registration Failed! (Error 400)</h2>
                <p>Missing required fields: <strong>${missingFields.join(
                  ", "
                )}</strong>.</p>
                <a href="/register.html" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Return to Registration</a>
            </div>
        `);
  }

  try {
    const newId = await saveVolunteer(data);

    // On successful registration, redirect to the dashboard, passing the email as a query parameter
    res.redirect(`/dashboard.html?email=${encodeURIComponent(data.email)}`);
  } catch (error) {
    let message = "An unexpected error occurred during registration.";

    // PostgreSQL error code '23505' indicates a unique constraint violation (duplicate email)
    if (error.code === "23505") {
      message = "This email address is already registered. Please log in.";
    }

    res.status(500).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba;">
                <h2>Server Error! (Error 500)</h2>
                <p>${message}</p>
                <a href="/register.html" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #ffc107; color: black; text-decoration: none; border-radius: 5px;">Return to Registration</a>
            </div>
        `);
  }
});

// --- API Route to Get Volunteer Data by Email (Dashboard Fetch) ---
app.get("/api/volunteer/:email", async (req, res) => {
  const email = req.params.email;
  if (!email) {
    return res.status(400).json({ error: "Email parameter is required." });
  }

  try {
    const volunteer = await getVolunteerByEmail(email);

    if (volunteer) {
      // Optional: Remove sensitive internal IDs or timestamps before sending to the client
      delete volunteer.id;
      delete volunteer.created_at;

      res.json(volunteer);
    } else {
      res.status(404).json({ error: "Volunteer not found." });
    }
  } catch (error) {
    console.error(`Error fetching volunteer ${email}:`, error);
    res.status(500).json({ error: "Failed to retrieve volunteer data." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `HopeDeeds Registration Server running at http://localhost:${PORT}`
  );
  console.log(`Static files served from: ${path.join(__dirname, "public")}`);
});
