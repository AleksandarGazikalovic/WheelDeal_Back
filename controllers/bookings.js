const Booking = require("../models/Booking");
const Post = require("../models/Post");
const AppError = require("../modules/errorHandling/AppError");
const BookingService = require("../services/bookings");

const bookingService = new BookingService();

class BookingsController {
  async createBooking(req, res) {
    const { postId } = req.body;
    const booking = await bookingService.createBooking(postId, req.body);
    res.status(201).json(booking);
  }

  async getPostTakenDates(req, res) {
    const bookings = await bookingService.getAllPostBookings(
      req.params.postId,
      {
        postId: req.params.postId,
      }
    );

    const takenDates = await bookingService.getTakenDates(bookings);
    res.status(200).json(takenDates);
  }
}

module.exports = BookingsController;
