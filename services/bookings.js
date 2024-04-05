const Booking = require("../models/Booking");
const Post = require("../models/Post");
const AppError = require("../modules/errorHandling/AppError");
const BookingRepository = require("../repositories/bookings");
const PostService = require("./posts");

const postService = new PostService();
const bookingRepository = new BookingRepository();

class BookingService {
  async getBooking(bookingData) {
    const booking = await bookingRepository.getBookingByFields(bookingData);
    return booking;
  }

  async getAllPostBookings(postId, bookingData) {
    const post = await postService.getPost({ _id: postId });
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    const booking = await bookingRepository.getAllBookingsByFields(bookingData);
    return booking;
  }

  async createBooking(bookingData) {
    const { postId } = bookingData;
    const post = await postService.getPost({ _id: postId });
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    const host = post.userId;
    const booking = await bookingRepository.createBooking({
      hostId: host,
      ...bookingData,
    });
    return booking;
  }

  async getTakenDates(bookings) {
    let takenDates = [];
    bookings.forEach((booking) => {
      let date = booking.startDate;
      while (date <= booking.endDate) {
        takenDates.push(date.toISOString().split("T")[0]);
        date.setDate(date.getDate() + 1);
      }
    });
    return takenDates;
  }
}

module.exports = BookingService;
