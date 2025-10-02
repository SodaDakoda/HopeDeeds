const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
// This import requires 'database.js' to be in the same root directory as server.js
const { saveVolunteer } = require("./database");

const app = express();
const PORT = 8080; // Changed port from 3000 to 8080

// Middleware setup
// Serves static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));
// Parses incoming request bodies in a middleware before your handlers
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Volunteer Registration POST Route ---
app.post("/register", async (req, res) => {
  const data = req.body;
  console.log("Received registration data:", data);

  // 1. Basic Validation
  const requiredFields = [
    "full_name",
    "email",
    "phone",
    "birthdate",
    "waiver_agreed",
  ];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    // Simple HTML response for error - usually handled by client-side or a proper view engine
    return res.status(400).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;">
                <h2>Registration Failed! (Error 400)</h2>
                <p>Missing required fields: <strong>${missingFields.join(
                  ", "
                )}</strong>.</p>
                <p>Please go back and ensure all fields, including the Waiver Agreement checkbox, are checked.</p>
                <a href="/register.html" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Return to Registration</a>
            </div>
        `);
  }

  // 2. Save to Database
  try {
    const newId = await saveVolunteer(data);

    // 3. Success Response: Redirect to a simple success page or the dashboard
    res.status(200).send(`
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;">
                <h2>Registration Successful! 🎉</h2>
                <p>Welcome to HopeDeeds, ${data.full_name}.</p>
                <p>Your volunteer ID is: <strong>${newId}</strong>. Your waiver agreement has been recorded.</p>
                <a href="/dashboard.html" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">Go to Volunteer Dashboard</a>
            </div>
        `);
  } catch (error) {
    // Handle database errors (e.g., unique constraint violation for email)
    let message = "An unexpected error occurred during registration.";
    if (error.message.includes("UNIQUE constraint failed: volunteers.email")) {
      message = "This email address is already registered.";
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

// Start the server
app.listen(PORT, () => {
  console.log(
    `HopeDeeds Registration Server running at http://localhost:${PORT}`
  );
  console.log(`Static files served from: ${path.join(__dirname, "public")}`);
  console.log("Database initialized (hopedeeds.db)");
});
