const User = require("../models/User");
const router = require("express").Router();
const multer = require("multer");
const crypto = require("crypto");
const dotenv = require("dotenv");
const {
  getImageSignedUrlS3,
  deleteImageFromS3,
  uploadProfileImageToS3,
} = require("../modules/aws_s3");
const { verifyToken } = require("../modules/authentication");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

//update user
router.put("/:id", async (req, res) => {
  if (req.body._id === req.params.id || req.body.isAdmin === "true") {
    delete req.body.profileImage;
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      );
      const { password, updatedAt, profileImage, ...other } = user._doc;
      res.status(200).json(other);
    } catch (err) {
      console.log(err);
      return res.status(500).json(err);
    }
  } else {
    return res
      .status(403)
      .json({ message: "You can update only your account!" });
  }
});

//delete user
router.delete("/:id", async (req, res) => {
  if (req.body._id === req.params.id || req.body.isAdmin === "true") {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Account has been deleted" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    return res
      .status(403)
      .json({ message: "You can delete only your account!" });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { password, updatedAt, ...other } = user._doc;
    const profileImage = other.profileImage;

    if (profileImage !== "") {
      other.profileImage = await getImageSignedUrlS3(profileImage);
    }
    res.status(200).json(other);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get a user
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, updatedAt, ...other } = user._doc;
    const profileImage = other.profileImage;

    if (profileImage !== "") {
      other.profileImage = await getImageSignedUrlS3(profileImage);
    }
    res.status(200).json(other);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//upload profile picture
router.post("/:id/upload", upload.single("profileImage"), async (req, res) => {
  if (req.body._id === req.params.id || req.body.isAdmin === "true") {
    try {
      const file = req.file;
      const fileName = randomImageName();
      await uploadProfileImageToS3(file, fileName);

      let user = await User.findById(req.params.id);
      const oldProfileImage = user.profileImage;
      if (oldProfileImage !== "") {
        await deleteImageFromS3(oldProfileImage);
      }
      // Update only the profileImage field in the user object
      user = await User.findByIdAndUpdate(
        req.params.id,
        { profileImage: fileName },
        { new: true } // This option returns the updated document
      );

      if (user.profileImage !== "") {
        const signedUrl = await getImageSignedUrlS3(user.profileImage);
        res.status(200).json(signedUrl);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    return res
      .status(403)
      .json({ message: "You can update only your account!" });
  }
});

module.exports = router;
