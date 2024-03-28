const router = require("express").Router();

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const BookingsController = require("../controllers/bookings");

const bookingsController = new BookingsController();

// Create a booking
router.post(
  "/",
  verifyToken,
  tryCatch(async (req, res) => {
    await bookingsController.createBooking(req, res);
  })
);

// Get all taken dates for a specific post
router.get(
  "/post/:postId/dates",
  tryCatch(async (req, res) => {
    await bookingsController.getPostTakenDates(req, res);
  })
);

module.exports = router;
