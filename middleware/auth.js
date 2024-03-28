const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const AppError = require("../modules/errorHandling/AppError");

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
    throw new AppError("Unauthorized", 401);
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // add logic to detect if someone tampered with access token
    if (err) {
      if (err.name == "TokenExpiredError") {
        throw new AppError("Access token expired", 401);
      } else {
        throw new AppError(
          "Unauthorized, token signature usuccessfuly verified",
          401
        );
      }
    }
    req.user = decoded;
    next();
  });
};

module.exports = { verifyToken };
