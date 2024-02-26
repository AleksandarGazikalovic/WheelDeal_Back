const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const multer = require("multer");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");
const logoPath = "/images/logo.png";

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

// Configure nodemailer for sending emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "gazikalovicaleksandar@gmail.com",
    pass: "xjxa adik reyk qgck",
  },
});

// make a function that is called if access token has expired while targeting an endpoint using VerifyToken to check access token validity
// 1. if refresh token hasn't expired, renew both the access token and refresh token (update refresh token change in database for user)
// 2. if refresh token has expired, remove refresh token cookie from client and return unauthorized response
router.get("/handleAccessTokenExpiry", async (req, res) => {
  const authHeaders = req.headers.authorization;
  const cookie = req.cookies;
  if (!authHeaders || authHeaders === undefined) {
    return res.status(401).send({ message: "No access token provided" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "No access token provided" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // access token has expired
      const cookies = req.cookies;
      if (!cookies?.refreshToken)
        return res.status(401).send({ message: "Refresh token expired" });
      const refreshToken = cookies.refreshToken;

      jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err1, decoded1) => {
          if (err1) {
            // refresh token has expired
            const foundUser = await User.findOne({ refreshToken }).exec();
            let newRefreshTokenArray = foundUser.refreshToken.filter(
              (rt) => rt !== refreshToken
            );
            foundUser.refreshToken = [...newRefreshTokenArray];
            const result = await foundUser.save();
            res.clearCookie("refreshToken", {
              httpOnly: true,
              secure: true,
              sameSite: "None",
            });
            return res.status(401).send({ message: "Refresh token expired" });
          }
          if (decoded1) {
            // refresh token is still valid
            const foundUser = await User.findOne({ refreshToken }).exec();

            if (!foundUser) {
              // this is most likely an attempt of refresh token reuse
              res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: true,
                sameSite: "None",
              });
              return res
                .status(403)
                .send({ message: "Detected attempted refresh token reuse!" });
            }

            // Issue new access and refresh tokens
            const accessToken = jwt.sign(
              { id: foundUser._id.valueOf() },
              process.env.ACCESS_TOKEN_SECRET,
              {
                expiresIn: process.env.ACCESS_TOKEN_DURATION,
              }
            );

            // in case we choose that new refresh token inherits the old refresh token's expiry date
            // let currentTimestamp = Math.round(Number(new Date()) / 1000)
            // let newTimestamp = Number(decoded1.exp) - currentTimestamp

            // console.log("Performing refresh token rotation - handleAccessTokenExpiry")
            const newRefreshToken = jwt.sign(
              { id: foundUser._id.valueOf() },
              process.env.REFRESH_TOKEN_SECRET,
              {
                expiresIn: process.env.REFRESH_TOKEN_DURATION, //newTimestamp
              }
            );

            //console.log(decoded1.exp - currentTimestamp)

            let newRefreshTokenArray = foundUser.refreshToken.filter(
              (rt) => rt !== refreshToken
            );
            foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
            const result = await foundUser.save();

            res.cookie("refreshToken", newRefreshToken, {
              httpOnly: true,
              secure: true,
              sameSite: "None",
              maxAge: 30 * 24 * 60 * 60 * 1000,
            }); // set cookie max age to 30 days
            return res.status(200).json({ accessToken: accessToken });
          }
        }
      );
    }
  });
});

router.get("/handleRefreshToken", async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) return res.status(401).send();
  const refreshToken = cookies.refreshToken;

  const foundUser = await User.findOne({ refreshToken }).exec();

  // Detected refresh token reuse! - refresh token has been deleted earlier
  if (!foundUser) {
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        // attempted refresh token reuse!
        // console.log('attempted refresh token reuse!')
        res.clearCookie("refreshToken", {
          httpOnly: true,
          sameSite: "None",
          secure: true,
        });

        // stolen refresh token has expired - it is not in database anymore
        if (err) return res.status(403).send(); //Forbidden

        // stolen refresh token hasn't expired
        const hackedUser = await User.findOne({ _id: decoded.id }).exec();
        hackedUser.refreshToken = [];
        const result = await hackedUser.save();
        // console.log(result);
      }
    );
    return res.status(403).send(); //Forbidden
  }

  const newRefreshTokenArray = foundUser.refreshToken.filter(
    (rt) => rt !== refreshToken
  );

  // evaluate jwt
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      // console.log(decoded)
      if (err) {
        // if refresh token expired or is faulty, remove it and force user to login again!
        // console.log('expired refresh token')
        foundUser.refreshToken = [...newRefreshTokenArray];
        const result = await foundUser.save();

        res.clearCookie("refreshToken", {
          httpOnly: true,
          sameSite: "None",
          secure: true,
        });
        return res.status(401).send({ message: "Refresh token expired" });
      } else {
        if (err || foundUser._id.valueOf() !== decoded.id)
          return res.status(403).send();
        else {
          // Refresh token was still valid
          const accessToken = jwt.sign(
            { id: foundUser._id.valueOf() },
            process.env.ACCESS_TOKEN_SECRET,
            {
              expiresIn: process.env.ACCESS_TOKEN_DURATION,
            }
          );

          // console.log("Performing refresh token rotation - handleRefreshToken")
          const newRefreshToken = jwt.sign(
            { id: foundUser._id.valueOf() },
            process.env.REFRESH_TOKEN_SECRET,
            {
              expiresIn: process.env.REFRESH_TOKEN_DURATION,
            }
          );
          // Saving refreshToken with current user
          foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
          const result = await foundUser.save();

          // Creates Secure Cookie with refresh token
          res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "None",
            maxAge: 30 * 24 * 60 * 60 * 1000,
          }); // set cookie max age to 30 days

          return res.status(200).json({ accessToken });
        }
      }
    }
  );
});

//Register
router.post("/register", async (req, res) => {
  try {
    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use." });
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
    const cookies = req.cookies;

    // find user
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        message:
          "There is no existing user connnected with that email address.",
      });
    }

    // Check if the user is verified
    if (!user.isAccountVerified) {
      return res.status(403).json({
        message:
          "Email not verified. Please check your email for the verification link.",
      });
    }

    // compare password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!validPassword) {
      return res
        .status(400)
        .json({ message: "Failed to log in! Please check your credentials." });
    }

    const accessToken = jwt.sign(
      { id: user.id },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_DURATION,
      }
    );
    const newRefreshToken = jwt.sign(
      { id: user.id },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_DURATION,
      }
    );

    let newRefreshTokenArray = !cookies?.refreshToken
      ? user.refreshToken
      : user.refreshToken.filter((rt) => rt !== cookies.refreshToken);
    // console.log(newRefreshTokenArray)

    // if (cookies?.refreshToken) {

    //   /*
    //   Scenario added here:
    //       1) User logs in but never uses RT and does not logout
    //       2) RT is stolen
    //       3) If 1 & 2, reuse detection is needed to clear all RTs when user logs in
    //   */
    //   const oldRefreshToken = cookies.refreshToken;
    //   const foundToken = await User.findOne({ oldRefreshToken }).exec();
    //   // console.log(foundToken)

    //   // Detected refresh token reuse!
    //   if (!foundToken) {
    //       console.log('Attempted refresh token reuse at login!')
    //       // clear out ALL previous refresh tokens
    //       newRefreshTokenArray = [];
    //   }

    //   res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'None', secure: true });
    // }

    // Saving refreshToken with current user
    user.refreshToken = [...newRefreshTokenArray, newRefreshToken];
    const result = await user.save();

    // don't return list of refreshTokens to client
    user.refreshToken = [];

    // get signed url for profile image after saving refreshToken in database
    const profileImage = user.profileImage;

    if (profileImage !== "") {
      user.profileImage = await getProfileImageSignedUrlS3(
        profileImage,
        user.id
      );
    }

    // Creates Secure Cookie with refresh token
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }); // 30 * 24h * 60min * 60s * 1000ms - set cookie max age to 30 days

    // send response
    res.status(200).json({ user, accessToken });
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

// Logout
router.post("/logout", async (req, res) => {
  // On client, also delete the accessToken
  // console.log("Starting to log out..")
  const cookies = req.cookies;
  console.log(cookies);
  if (!cookies?.refreshToken) return res.sendStatus(204); //No content
  const refreshToken = cookies.refreshToken;

  // Is refreshToken in db?
  const foundUser = await User.findOne({ refreshToken }).exec();
  // console.log("Attempting to log out...")
  console.log(foundUser);
  if (!foundUser) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    return res.sendStatus(204);
  }

  // Delete refreshToken in db
  foundUser.refreshToken = foundUser.refreshToken.filter(
    (rt) => rt !== refreshToken
  );
  const result = await foundUser.save();
  console.log(result);

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
  });
  return res.sendStatus(204);
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
      res.status(200).json({ message: "Account has been verified" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  } else {
    return res
      .status(403)
      .json({ message: "You can verify only your account!" });
  }
});

// Route for initiating the forgot password process
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user with the given email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save the reset token and its expiration time to the user in the database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send an email to the user with the reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
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
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Update the user's password and clear the reset token fields
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
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
      .json({ error: "An error occurred during email verification." });
  }
});

// Function to send verification email
function sendVerificationEmail(name, email, token) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify/${token}`;
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
