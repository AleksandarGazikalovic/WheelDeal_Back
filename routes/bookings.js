const router = require("express").Router();
const Booking = require("../models/Booking");
const Post = require("../models/Post");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");

// Create a booking
router.post("/", verifyToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const post = await Post.findById(postId);
    const host = post.userId;
    const booking = new Booking({
      hostId: host,
      ...req.body,
    });
    await booking.save();
    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get all taken dates for a specific post
router.get("/post/:postId/dates", async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
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
    res.json(takenDates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
