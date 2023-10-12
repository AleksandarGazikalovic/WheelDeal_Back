const mongoose = require("mongoose");

const HostSchema = new mongoose.Schema(
  {
    age: {
      type: String,
    },
    reason: {
      type: Array,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Host", HostSchema);
