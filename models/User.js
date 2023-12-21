const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 3,
      max: 15,
    },
    surname: {
      type: String,
      required: true,
      min: 3,
      max: 15,
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
    },
    driverLicense: {
      type: String,
      min: 9,
      max: 9,
    },
    phone: {
      type: String,
      min: 9,
      max: 11,
    },
    address: {
      type: String,
      min: 10,
      max: 50,
    },
    city: {
      type: String,
      max: 50,
    },
    likedPosts: {
      type: Array,
      default: [],
    },
    profileImage: {
      type: String,
      default: "",
    },
    desc: {
      type: String,
      max: 50,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    isAccountVerified: {
      type: Boolean,
      default: false,
    },
    isLicenceVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
