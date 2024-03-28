const router = require("express").Router();

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const AuthController = require("../controllers/auth");

const authController = new AuthController();

// in case access token expires while user is performing an action on site (that requires access token)
router.get(
  "/handleAccessTokenExpiry",
  tryCatch(async (req, res) => {
    await authController.handleAccessTokenExpiry(req, res);
  })
);

// gets called on initial site landing page ()
router.get(
  "/handleRefreshToken",
  tryCatch(async (req, res) => {
    await authController.handleRefreshToken(req, res);
  })
);

//Register
router.post(
  "/register",
  tryCatch(async (req, res) => {
    await authController.registerUser(req, res);
  })
);

//Login
router.post(
  "/login",
  tryCatch(async (req, res) => {
    await authController.loginUser(req, res);
  })
);

// Logout
router.post(
  "/logout",
  tryCatch(async (req, res) => {
    await authController.logoutUser(req, res);
  })
);

//verify user
router.put(
  "/:id/verify",
  verifyToken,
  tryCatch(async (req, res) => {
    await authController.verifyUser(req, res);
  })
);

// Route for initiating the forgot password process
router.post(
  "/forgot-password",
  tryCatch(async (req, res) => {
    await authController.forgotPassword(req, res);
  })
);

// Route for resetting the password using the token
router.post(
  "/reset-password/:token",
  tryCatch(async (req, res) => {
    await authController.resetPassword(req, res);
  })
);

// Route for user token verification
router.get(
  "/verify/:token",
  tryCatch(async (req, res) => {
    await authController.verifyToken(req, res);
  })
);

module.exports = router;
