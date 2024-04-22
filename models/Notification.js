const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    title: {
      type: String,
      required: true,
      max: 50,
    },
    content: {
      type: String,
      required: true,
      max: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    isOpened: {
      type: Boolean,
      default: false,
      required: true,
    },
    notificationType: {
      type: String,
      required: true,
      enum: ["general", "post", "payment", "archive"],
      default: "general",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);
