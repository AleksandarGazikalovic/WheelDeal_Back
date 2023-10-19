const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

//Register
router.post("/register", async (req, res) => {
  try {
    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json("Email is already in use.");
    }
    console.log(req.body);
    // generate new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // create new user
    const newUser = new User({
      name: req.body.name,
      surname: req.body.surname,
      email: req.body.email,
      password: hashedPassword,
    });

    // save user and respond
    const user = await newUser.save();
    res.status(200).json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "An error occurred during registration." });
  }
});

//Login
router.post("/login", async (req, res) => {
  try {
    // find user
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json("User not found");
    }

    // compare password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json("Wrong password");
    }

    const profileImage = user.profileImage;

    if (profileImage !== "") {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: profileImage,
      });

      const signedUrl = await getSignedUrl(s3, command, {
        expiresIn: 3600,
      });

      user.profileImage = signedUrl;
    }

    const accessToken = jwt.sign(
      { id: user.id },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "30m",
      }
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: "30d",
      }
    );

    console.log(user);

    // send response
    res.status(200).json({ user, accessToken, refreshToken });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

//verify user
router.put("/:id/verify", async (req, res) => {
  if (req.body.userId === req.params.id || req.body.isAdmin) {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, {
        $set: {
          IDCard: req.body.IDCard,
          driverLicense: req.body.driverLicense,
          phone: req.body.phone,
          address: req.body.address,
          city: req.body.city,
          isVerified: true,
        },
      });
      res.status(200).json("Account has been verified");
    } catch (err) {
      return res.status(500).json(err);
    }
  } else {
    return res.status(403).json("You can verify only your account!");
  }
});

module.exports = router;
