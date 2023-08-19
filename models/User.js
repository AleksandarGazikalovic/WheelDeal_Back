const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      min: 3,
      max: 20,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      max: 50,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      min: 6,
    },
    IDCard: {
      type: String,
      min: 13,
      max: 13,
      unique: true,
    },
    driverLicense: {
      type: String,
      min: 9,
      max: 9,
      unique: true,
    },
    phone: {
      type: String,
      min: 9,
      max: 11,
      unique: true,
    },
    address: {
      type: String,
      min: 10,
      max: 50,
      unique: true,
    },
    city: {
      type: String,
      max: 50,
    },
    likedPosts: {
      type: Array,
      default: [],
    },
    desc: {
      type: String,
      max: 50,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
