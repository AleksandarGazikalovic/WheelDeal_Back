const BookingRepository = require("./bookings");
const CommentRepository = require("./comments");
const PostRepository = require("./posts");
const UserRepository = require("./users");
const VehicleRepository = require("./vehicles");

const repositoryInitializer = {
  bookingRepository: new BookingRepository(),
  commentRepository: new CommentRepository(),
  postRepository: new PostRepository(),
  userRepository: new UserRepository(),
  vehicleRepository: new VehicleRepository(),
};

module.exports = repositoryInitializer;
