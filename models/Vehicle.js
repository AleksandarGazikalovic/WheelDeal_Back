const mongoose = require("mongoose");

const VehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    images: {
      type: Array,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    carModel: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    desc: {
      type: String,
      max: 50,
    },
    mileage: {
      type: Number,
      required: true,
    },
    transmission: {
      type: String,
      required: true,
    },
    fuel: {
      type: String,
      required: true,
    },
    drive: {
      type: String,
      required: true,
    },
    engine: {
      type: String,
      required: true,
    },
    documents: {
      type: Array,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vehicle", VehicleSchema);
