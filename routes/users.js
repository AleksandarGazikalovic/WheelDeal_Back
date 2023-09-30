const User = require("../models/User");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const crypto = require("crypto");

dotenv.config();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

//update user
router.put("/:id", async (req, res) => {
  console.log(req.body);
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    if (req.body.password) {
      try {
        const salt = await bcrypt.genSalt(10);
        req.body.password = await bcrypt.hash(req.body.password, salt);
      } catch (err) {
        console.log(err);
        return res.status(500).json(err);
      }
    }
    try {
      const user = await User.findByIdAndUpdate(req.params.id, {
        $set: req.body,
      });
      res.status(200).json("Account has been updated");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can update only your account!");
  }
});

//delete user
router.delete("/:id", async (req, res) => {
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      res.status(200).json("Account has been deleted");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can delete only your account!");
  }
});

//get a user
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { password, updatedAt, ...other } = user._doc;
    const profileImage = other.profileImage;

    if (profileImage !== "") {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: profileImage,
      });

      const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: 3600,
      });

      other.profileImage = signedUrl;
    }
    res.status(200).json(other);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

//upload profile picture
router.post("/:id/upload", upload.single("profileImage"), async (req, res) => {
  console.log(req.file);
  console.log(req.body);
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    try {
      const file = req.file;
      const fileName = randomImageName();
      const fileType = file.mimetype;
      const fileContent = file.buffer;

      // Upload the new profile image to your storage (e.g., S3)
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        ContentType: fileType,
      });

      s3.send(command);

      // Update only the profileImage field in the user object
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { profileImage: fileName },
        { new: true } // This option returns the updated document
      );

      res.status(200).json({ message: "Profile image has been updated", user });
    } catch (err) {
      console.error(err);
      res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can update only your account!");
  }
});

module.exports = router;
