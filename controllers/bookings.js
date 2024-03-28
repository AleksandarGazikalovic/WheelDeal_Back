const router = require("express").Router();
const Booking = require("../models/Booking");
const Post = require("../models/Post");
const User = require("../models/User");
const AppError = require("../modules/errorHandling/AppError");

class BookingsController {
  async createBooking(req, res) {
    const { postId } = req.body;
    const post = await Post.findById(postId);
    const host = post.userId;
    const booking = new Booking({
      hostId: host,
      ...req.body,
    });
    await booking.save();
    res.status(201).json(booking);
  }

  async getPostTakenDates(req, res) {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    const bookings = await Booking.find({ postId });
    let takenDates = [];
    bookings.forEach((booking) => {
      let date = booking.startDate;
      while (date <= booking.endDate) {
        takenDates.push(date.toISOString().split("T")[0]);
        date.setDate(date.getDate() + 1);
      }
    });
    res.status(200).json(takenDates);
  }
}

module.exports = BookingsController;
