const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
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
});

const Location = mongoose.model("Location", locationSchema);
