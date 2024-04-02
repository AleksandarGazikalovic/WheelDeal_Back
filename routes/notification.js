const router = require("express").Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const dotenv = require("dotenv");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

// Fetch all notifications related to a user
router.get("/:id", async (req, res) => {
  try {
    //get all the notifications from that user
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const allNotifications = await Notification.find({
      user: req.params.id,
      $or: [
        { isOpened: false },
        { $and: [{ isOpened: true }, { createdAt: { $gt: oneMonthAgo } }] },
      ],
    });

    res.status(200).json({ allNotifications });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    notification.isOpened = true;
    await notification.save();
    res.status(200);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
