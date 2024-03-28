const User = require("../models/User");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");

const AppError = require("../modules/errorHandling/AppError");
const MailService = require("../modules/mail/mailService");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const mailService = new MailService();

class AuthController {
  async registerUser(req, res) {
    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      throw new AppError("Email is already in use.", 400);
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
    await mailService.sendVerificationEmail(
      req.body.name,
      req.body.email,
      verificationToken
    );

    res.status(200).json({
      message: "Registration successful. Check your email for verification.",
    });
  }

  async verifyUser(req, res) {
    if (req.body.userId === req.params.id || req.body.isAdmin) {
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
    } else {
      throw new AppError("You can verify only your account!", 403);
    }
  }

  async forgotPassword(req, res) {
    const { email } = req.body;

    // Find the user with the given email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save the reset token and its expiration time to the user in the database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send an email to the user with the reset link
    await mailService.sendResetPasswordEmail(user.name, user.email, resetToken);

    res.status(200).json({ message: "Password reset email sent successfully" });
  }

  async resetPassword(req, res) {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Find the user with the given reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is still valid
    });

    if (!user) {
      throw new AppError("Invalid or expired token", 400);
    }

    // Update the user's password and clear the reset token fields
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  }

  async verifyToken(req, res) {
    const token = req.params.token;

    // Find the user with the verification token
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      throw new AppError("Invalid verification token.", 404);
    }

    // Mark the user as verified and remove the verification token
    user.isAccountVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully." });
  }

  async loginUser(req, res) {
    const cookies = req.cookies;

    // find user
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      throw new AppError(
        "There is no existing user connnected with that email address.",
        404
      );
    }

    // Check if the user is verified
    if (!user.isAccountVerified) {
      throw new AppError(
        "Email not verified. Please check your email for the verification link.",
        403
      );
    }

    // compare password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!validPassword) {
      throw new AppError(
        "Failed to log in! Please check your credentials.",
        400
      );
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
  }

  async logoutUser(req, res) {
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
  }

  // make a function that is called if access token has expired while targeting an endpoint using VerifyToken to check access token validity
  // 1. if refresh token hasn't expired, renew both the access token and refresh token (update refresh token change in database for user)
  // 2. if refresh token has expired, remove refresh token cookie from client and return unauthorized response
  async handleAccessTokenExpiry(req, res) {
    const authHeaders = req.headers.authorization;
    const cookie = req.cookies;
    if (!authHeaders || authHeaders === undefined) {
      throw new AppError("No access token provided.", 401);
    }
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      throw new AppError("No access token provided.", 401);
    }
    await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decoded) => {
        if (err) {
          // access token has expired
          const cookies = req.cookies;
          if (!cookies?.refreshToken) {
            // throw new AppError("Refresh token expired", 401);
            throw new AppError("Missing refresh token", 401);
          }
          const refreshToken = cookies.refreshToken;

          await jwt.verify(
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
                throw new AppError("Refresh token expired", 401);
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
                  throw new AppError(
                    "Detected attempted refresh token reuse!",
                    403
                  );
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
                foundUser.refreshToken = [
                  ...newRefreshTokenArray,
                  newRefreshToken,
                ];
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
      }
    );
  }

  async handleRefreshToken(req, res) {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) {
      throw new AppError("No user detected", 401);
    }
    const refreshToken = cookies.refreshToken;

    const foundUser = await User.findOne({ refreshToken }).exec();

    // Detected refresh token reuse! - refresh token has been deleted earlier
    if (!foundUser) {
      await jwt.verify(
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
          if (err) {
            throw new AppError("", 403);
          }

          // stolen refresh token hasn't expired
          const hackedUser = await User.findOne({ _id: decoded.id }).exec();
          hackedUser.refreshToken = [];
          const result = await hackedUser.save();
          // console.log(result);
        }
      );
      throw new AppError("", 403);
    }

    const newRefreshTokenArray = foundUser.refreshToken.filter(
      (rt) => rt !== refreshToken
    );

    // evaluate jwt
    await jwt.verify(
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
          throw new AppError("Refresh token expired", 401);
        } else {
          if (err || foundUser._id.valueOf() !== decoded.id)
            throw new AppError("", 403);
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
  }
}

module.exports = AuthController;
