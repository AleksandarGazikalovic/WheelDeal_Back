const Booking = require("../models/Booking");
const dependencyContainer = require("../modules/dependencyContainer");

class BookingRepository {
  constructor() {
    dependencyContainer.register("bookingRepository", this);
  }

  // create booking with given fields
  async createBooking(bookingData) {
    const newBooking = new Booking(bookingData);
    await newBooking.save();
    return newBooking;
  }

  // find booking using any fields and their values
  async getBookingByFields(searchData) {
    const foundBooking = await Booking.findOne(searchData);
    return foundBooking;
  }

  // find all bookings by matching criteria
  async getAllBookingsByFields(searchData) {
    const foundBookings = await Booking.find(searchData);
    return foundBookings;
  }
}

module.exports = BookingRepository;
