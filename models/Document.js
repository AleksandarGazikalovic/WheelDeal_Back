const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },
  type: {
    type: String,
    enum: [
      "idCard",
      "vehicleLicense",
      "registrationExpiry",
      "vehicleInsurance",
    ],
    required: true,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  image: {
    type: String,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  rejected: {
    type: Boolean,
    default: false,
  },
  reason: {
    type: String,
  },
  note: {
    type: String,
  },
});

module.exports = mongoose.model("Document", documentSchema);
