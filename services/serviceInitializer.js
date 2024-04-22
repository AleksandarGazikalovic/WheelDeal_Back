const VehicleService = require("./vehicles");
const UserService = require("./users");
const MailService = require("../modules/mail/mailService");
const DateConverter = require("../modules/dateConverter");
const PostService = require("./posts");
const CommentService = require("./comments");
const BookingService = require("./bookings");
const AuthService = require("./auth");

const serviceInitializer = {
  vehicleService: new VehicleService(),
  userService: new UserService(),
  mailService: new MailService(),
  dateConverter: new DateConverter(),
  postService: new PostService(),
  commentService: new CommentService(),
  bookingService: new BookingService(),
  authService: new AuthService(),
};

module.exports = serviceInitializer;
