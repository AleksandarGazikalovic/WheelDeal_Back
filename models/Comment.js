const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the User model
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post", // Reference to the Post model
    required: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    required: true,
    max: 50,
  },
  content: {
    type: String,
    max: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
