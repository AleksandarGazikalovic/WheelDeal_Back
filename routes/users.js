const User = require("../models/User");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` })
}
else {
  dotenv.config({ path: `.env.development` })
}

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

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = req.headers.authorization?.split(" ")[1];
  if (!authHeader || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => { // add logic to detect if someone tampered with access token
    if (err) {
      if (err.name == "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      } else {
        return res.status(401).json({ message: "Unauthorized, token signature usuccessfuly verified" });
      }
    }
    req.user = decoded;
    next();
  });
};

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
    return res.status(403).json({ message: "You can update only your account!" });
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
    return res.status(403).json({ message: "You can delete only your account!" });
  }
});

router.get("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
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
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//upload profile picture
router.post("/:id/upload", upload.single("profileImage"), async (req, res) => {
  if (req.body._id === req.params.id || req.body.isAdmin === "true") {
    try {
      const file = req.file;
      const fileName = randomImageName();
      const fileType = file.mimetype;
      const fileContent = file.buffer;

      // Resize and compress the image
      const resizedImageBuffer = await sharp(fileContent)
        .resize({ width: 200, height: 200 }) // Adjust the dimensions as needed
        .toBuffer();

      // Upload the new profile image to your storage (e.g., S3)
      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: resizedImageBuffer,
        ContentType: fileType,
      });

      s3.send(command);

      let user = await User.findById(req.params.id);
      const oldProfileImage = user.profileImage;
      if (oldProfileImage !== "") {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: oldProfileImage,
        });
        s3.send(deleteCommand);
      }
      // Update only the profileImage field in the user object
      user = await User.findByIdAndUpdate(
        req.params.id,
        { profileImage: fileName },
        { new: true } // This option returns the updated document
      );

      if (user.profileImage !== "") {
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: user.profileImage,
        });

        const signedUrl = await getSignedUrl(s3, command, {
          expiresIn: 3600,
        });
        res.status(200).json(signedUrl);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    return res.status(403).json({ message: "You can update only your account!" });
  }
});

module.exports = router;
