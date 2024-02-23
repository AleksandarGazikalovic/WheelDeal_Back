const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = req.headers.authorization?.split(" ")[1];
  if (!authHeader || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // add logic to detect if someone tampered with access token
    if (err) {
      if (err.name == "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      } else {
        return res.status(401).json({
          message: "Unauthorized, token signature usuccessfuly verified",
        });
      }
    }
    req.user = decoded;
    next();
  });
};

module.exports = { verifyToken };
