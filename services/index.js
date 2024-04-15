const { inject } = require("dioma");
const AuthService = require("./auth");
const BookingService = require("./bookings");
const CommentService = require("./comments");
const PostService = require("./posts");
const UserService = require("./users");
const VehicleService = require("./vehicles");

const services = {
  authService: inject(AuthService),
  bookingService: inject(BookingService),
  commentService: inject(CommentService),
  postService: inject(PostService),
  userService: inject(UserService),
  vehicleService: inject(VehicleService),
};

module.exports = { services };
