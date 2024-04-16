const router = require("express").Router();

const { inject } = require("dioma");
const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const AuthService = require("../services/auth");

function createAuthRoutes(authService = inject(AuthService)) {
  // in case access token expires while user is performing an action on site (that requires access token)
  router.get(
    "/handleAccessTokenExpiry",
    tryCatch(async (req, res) => {
      await authService.handleAccessTokenExpiryFromRoute(req, res);
    })
  );

  // gets called on initial site landing page ()
  router.get(
    "/handleRefreshToken",
    tryCatch(async (req, res) => {
      await authService.handleRefreshTokenFromRoute(req, res);
    })
  );

  //Register
  router.post(
    "/register",
    tryCatch(async (req, res) => {
      await authService.registerUserFromRoute(req, res);
    })
  );

  //Login
  router.post(
    "/login",
    tryCatch(async (req, res) => {
      await authService.loginUserFromRoute(req, res);
    })
  );

  // Logout
  router.post(
    "/logout",
    tryCatch(async (req, res) => {
      await authService.logoutUserFromRoute(req, res);
    })
  );

  //verify user - is this deprecated??
  router.put(
    "/:id/verify",
    verifyToken,
    tryCatch(async (req, res) => {
      await authService.verifyUserFromRoute(req, res);
    })
  );

  // Route for initiating the forgot password process
  router.post(
    "/forgot-password",
    tryCatch(async (req, res) => {
      await authService.forgotPasswordFromRoute(req, res);
    })
  );

  // Route for resetting the password using the token
  router.post(
    "/reset-password/:token",
    tryCatch(async (req, res) => {
      await authService.resetPasswordFromRoute(req, res);
    })
  );

  // Route for user token verification
  router.get(
    "/verify/:token",
    tryCatch(async (req, res) => {
      await authService.verifyTokenFromRoute(req, res);
    })
  );

  return router;
}

module.exports = { createAuthRoutes };
