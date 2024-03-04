const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema(
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
    location: {
      address: {
        type: String,
        required: true,
      },
      latLng: {
        lat: {
          type: Number,
          required: true,
        },
        lng: {
          type: Number,
          required: true,
        },
      },
    },
    price: {
      type: Number,
      required: true,
    },
    from: {
      type: Date,
      required: true,
    },
    to: {
      type: Date,
      required: true,
    },
    isRented: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
