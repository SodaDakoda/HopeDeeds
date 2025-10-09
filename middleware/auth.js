// middleware/auth.js

// Example: middleware to protect admin/manager routes
const adminOnly = (req, res, next) => {
  // Check that req.user exists (populated by your login/auth middleware)
  if (req.user && (req.user.role === "admin" || req.user.role === "manager")) {
    return next(); // Authorized — continue to the route
  }

  console.warn(
    `Unauthorized access attempt by user ${
      req.user ? req.user.email : "unknown"
    }`
  );
  return res
    .status(403)
    .json({ message: "Forbidden: Administrator access required." });
};

module.exports = { adminOnly };
