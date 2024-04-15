const { Scopes, inject } = require("dioma");
const AppError = require("../modules/errorHandling/AppError");
const BookingRepository = require("../repositories/bookings");
const PostService = require("./posts");

class BookingService {
  constructor(
    postService = inject(PostService),
    bookingRepository = inject(BookingRepository)
  ) {
    this.postService = postService;
    this.bookingRepository = bookingRepository;
  }
  static scope = Scopes.Singleton();

  async getBooking(bookingData) {
    const booking = await this.bookingRepository.getBookingByFields(
      bookingData
    );
    return booking;
  }

  async getAllPostBookings(postId, bookingData) {
    const post = await this.postService.getPost({ _id: postId });
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    const booking = await this.bookingRepository.getAllBookingsByFields(
      bookingData
    );
    return booking;
  }

  async createBooking(bookingData) {
    const { postId } = bookingData;
    const post = await this.postService.getPost({ _id: postId });
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    const host = post.userId;
    const booking = await this.bookingRepository.createBooking({
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

  //
  async createBookingFromRoute(req, res) {
    const booking = await this.createBooking(req.body);
    res.status(201).json(booking);
  }

  //
  async getPostTakenDatesFromRoute(req, res) {
    const bookings = await this.getAllPostBookings(req.params.postId, {
      postId: req.params.postId,
    });

    const takenDates = await this.getTakenDates(bookings);
    res.status(200).json(takenDates);
  }
}

module.exports = BookingService;
