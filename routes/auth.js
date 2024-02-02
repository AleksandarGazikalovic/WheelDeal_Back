const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const logoPath = "/images/logo.png";

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

// Configure nodemailer for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gazikalovicaleksandar@gmail.com",
    pass: "xjxa adik reyk qgck",
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
    // generate new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    // create new user with a verification token
    const verificationToken = crypto.randomBytes(20).toString("hex");
    const newUser = new User({
      name: req.body.name,
      surname: req.body.surname,
      email: req.body.email,
      password: hashedPassword,
      verificationToken: verificationToken,
    });

    // save user
    await newUser.save();

    // send verification email
    sendVerificationEmail(req.body.name, req.body.email, verificationToken);

    res.status(200).json({
      message: "Registration successful. Check your email for verification.",
    });
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

    // Check if the user is verified
    if (!user.isAccountVerified) {
      return res
        .status(403)
        .json(
          "Email not verified. Please check your email for the verification link."
        );
    }

    // compare password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!validPassword) {
      return res
        .status(400)
        .json("Failed to log in! Please check your credentials.");
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
          isLicenceVerified: true,
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

// Route for initiating the forgot password process
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user with the given email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save the reset token and its expiration time to the user in the database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send an email to the user with the reset link
    const resetLink = `${process.env.BASE_URL}reset-password/${resetToken}`;
    const mailOptions = {
      from: "gazikalovicaleksandar@gmail.com",
      to: user.email,
      subject: "Password Reset Request",
      html: getPasswordResetEmail(user.name, resetLink),
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route for resetting the password using the token
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Find the user with the given reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is still valid
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Update the user's password and clear the reset token fields
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;

    // Find the user with the verification token
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(404).json({ message: "Invalid verification token." });
    }

    // Mark the user as verified and remove the verification token
    user.isAccountVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully." });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "An error occurred during email verification." });
  }
});

// Function to send verification email
function sendVerificationEmail(name, email, token) {
  const verificationLink = `${process.env.BASE_URL}verify/${token}`;
  const mailOptions = {
    from: "gazikalovicaleksandar@gmail.com",
    to: email,
    subject: "Welcome to WheelDeal - Verify Your Email Address",
    html: getAccountVerificationEmail(name, verificationLink),
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

// Function to generate HTML email content with logo
function getPasswordResetEmail(username, resetLink) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .logo {
          text-align: center;
        }
        .logo img {
          max-width: 100px;
          height: auto;
        }
        .content {
          margin-top: 20px;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="${logoPath}" alt="WheelDeal">
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${username},</p>
          <p>We received a request to reset your password. To reset your password, click on the link below:</p>
          <p><a href="${resetLink}">Reset Your Password</a></p>
          <p>If you didn't request a password reset, please ignore this email.</p>
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>Thank you,<br>WheelDeal</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Function to generate HTML email content with logo
function getAccountVerificationEmail(username, verificationLink) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .logo {
          text-align: center;
        }
        .logo img {
          max-width: 100px;
          height: auto;
        }
        .content {
          margin-top: 20px;
          text-align: left;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="${logoPath}" alt="WheelDeal">
        </div>
        <div class="content">
          <h2>Welcome to WheelDeal</h2>
          <p>Hello ${username},</p>
          <p>Thank you for registering on WheelDeal. To verify your email address, click on the link below:</p>
          <p><a href="${verificationLink}">Verify Your Email Address</a></p>
          <p>Thank you,<br>WheelDeal</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;
