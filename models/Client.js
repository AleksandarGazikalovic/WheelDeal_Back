const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema(
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

module.exports = mongoose.model("Client", ClientSchema);
