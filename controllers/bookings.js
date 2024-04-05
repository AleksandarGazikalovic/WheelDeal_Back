const BookingService = require("../services/bookings");

const bookingService = new BookingService();

class BookingsController {
  //
  async createBooking(req, res) {
    const booking = await bookingService.createBooking(req.body);
    res.status(201).json(booking);
  }

  //
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
