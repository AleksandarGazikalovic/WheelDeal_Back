const router = require("express").Router();

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");

function createBookingRoutes(bookingService) {
  // Create a booking
  router.post(
    "/",
    verifyToken,
    tryCatch(async (req, res) => {
      await bookingService.createBookingFromRoute(req, res);
    })
  );

  // Get all taken dates for a specific post
  router.get(
    "/post/:postId/dates",
    tryCatch(async (req, res) => {
      await bookingService.getPostTakenDatesFromRoute(req, res);
    })
  );

  return router;
}

module.exports = { createBookingRoutes };
