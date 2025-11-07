// middleware/auth.js

const adminOnly = (req, res, next) => {
  // Check that an organization is logged in via session
  if (req.session && req.session.orgId) {
    return next(); // Authorized — continue to the route
  }

  console.warn(`Unauthorized access attempt`);
  return res
    .status(403)
    .json({
      message: "Forbidden: You must be logged in as an organization admin.",
    });
};

module.exports = { adminOnly };
