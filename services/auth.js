const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const AppError = require("../modules/errorHandling/AppError");
const MailService = require("../modules/mail/mailService");
const UserService = require("./users");
const { inject, Scopes } = require("dioma");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

class AuthService {
  constructor(
    userService = inject(UserService),
    mailService = inject(MailService)
  ) {
    this.userService = userService;
    this.mailService = mailService;
  }
  static scope = Scopes.Singleton();

  async checkEmailAlreadyUsed(email) {
    const userExists = await this.userService.getUser({ email: email });
    if (userExists) {
      throw new AppError("Email is already in use.", 400);
    }
  }

  async generateHashedPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  }

  async registerNewUser(name, surname, email, hashedPassword) {
    // create user with pending registration in database
    const verificationToken = crypto.randomBytes(20).toString("hex");
    await this.userService.saveUserWithPendingRegistration(
      name,
      surname,
      email,
      hashedPassword,
      verificationToken
    );

    // send verification email
    await this.mailService.sendVerificationEmail(
      name,
      email,
      verificationToken
    );
  }

  async checkUserCredentials(email, password) {
    // get user from database
    const user = await this.checkUserWithEmailExists(email);

    // Check if the user is verified
    await this.checkAccountVerified(user);

    // compare password
    await this.checkValidPassword(password, user);

    return user;
  }

  async checkAccountVerified(user) {
    if (!user.isAccountVerified) {
      throw new AppError(
        "Email not verified. Please check your email for the verification link.",
        403
      );
    }
  }

  async checkValidPassword(password, user) {
    // compare password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      throw new AppError(
        "Failed to log in! Please check your credentials.",
        400
      );
    }
  }

  async checkUserHasAccess(req) {
    if (req.body.userId === req.params.id || req.body.isAdmin) {
      return true;
    } else {
      throw new AppError("You can verify only your account!", 403);
    }
  }

  async verifyUser(req) {
    await this.userService.updateUser(req.params.id, {
      IDCard: req.body.IDCard,
      driverLicence: req.body.driverLicence,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      isLicenceVerified: true,
    });
  }

  async issueAccessToken(userId) {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_DURATION,
      }
    );
    return accessToken;
  }

  async issueRefreshToken(userId) {
    const refreshToken = jwt.sign(
      { id: userId },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_DURATION,
      }
    );
    return refreshToken;
  }

  async issueAccessRefreshTokens(user, req, res) {
    const cookies = req.cookies;
    const accessToken = await this.issueAccessToken(user.id);
    const newRefreshToken = await this.issueRefreshToken(user.id);

    let newRefreshTokenArray = !cookies?.refreshToken
      ? user.refreshToken
      : user.refreshToken.filter((rt) => rt !== cookies.refreshToken);
    // console.log(newRefreshTokenArray)

    // Saving refreshToken with current user
    const newRefreshTokenField = [...newRefreshTokenArray, newRefreshToken];
    await this.userService.updateUser(user.id, {
      refreshToken: newRefreshTokenField,
    });

    // don't return list of refreshTokens to client
    user.refreshToken = [];

    // get signed url for profile image after saving refreshToken in database
    const profileImage = user.profileImage;
    if (profileImage !== "") {
      user.profileImage = await this.userService.getProfileImage(
        profileImage,
        user.id
      );
    }

    // Creates Secure Cookie with refresh token
    await this.createRefreshTokenCookie(res, newRefreshToken);

    return [user, accessToken];
  }

  async logoutUser(req, res) {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) return 204; //No content

    const refreshToken = cookies.refreshToken;

    // Is refreshToken in db?
    const foundUser = await this.userService.getUser({
      refreshToken: refreshToken,
    });

    // if not, clear the given cookie (not sure if possible?)
    if (!foundUser) {
      await this.removeRefreshTokenCookie(res);
      return 204;
    }

    // if yes, delete refreshToken in db
    foundUser.refreshToken = foundUser.refreshToken.filter(
      (rt) => rt !== refreshToken
    );
    await this.userService.updateUser(foundUser.id, {
      refreshToken: foundUser.refreshToken,
    });

    // clear refresh token cookie
    await this.removeRefreshTokenCookie(res);
    return 204;
  }

  async checkUserWithEmailExists(email) {
    const user = await this.userService.getUser({ email: email });

    if (!user) {
      throw new AppError("There is no user with this email address", 404);
    }

    return user;
  }

  async generateResetTokenAndSendMail(user) {
    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Save the reset token and its expiration time to the user in the database
    const resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour

    await this.userService.updateUser(user.id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetPasswordExpires,
    });

    // Send an email to the user with the reset link
    await this.mailService.sendResetPasswordEmail(
      user.name,
      user.email,
      resetToken
    );
  }

  async findUserWithResetToken(token) {
    const user = await this.userService.getUser({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new AppError("Invalid or expired token", 400);
    }

    return user;
  }

  async findUserWithVerificationToken(token) {
    const user = await this.userService.getUser({ verificationToken: token });

    if (!user) {
      throw new AppError("Invalid verification token.", 404);
    }

    return user;
  }

  async verifyUserAccount(user) {
    await this.userService.updateUser(user.id, {
      isAccountVerified: true,
      verificationToken: undefined,
    });
  }

  async performPasswordReset(user, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await this.userService.updateUser(user._id.toString(), {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });
  }

  async extractRefreshToken(req) {
    const cookies = req.cookies;
    if (!cookies?.refreshToken) {
      throw new AppError("No user detected", 401);
    }
    return cookies.refreshToken;
  }

  async getUserByRefreshToken(refreshToken) {
    const foundUser = await this.userService.getUser({
      refreshToken: refreshToken,
    });
    return foundUser;
  }

  async handleRefreshToken(foundUser, refreshToken, newRefreshTokenArray, res) {
    await jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        // console.log(decoded)
        if (err) {
          // if refresh token expired or is faulty, remove it and force user to login again!
          await this.handleFaultyRefreshToken(
            foundUser,
            newRefreshTokenArray,
            res
          );
        } else {
          if (err || foundUser._id.valueOf() !== decoded.id)
            throw new AppError("", 403);
          else {
            // Refresh token was still valid
            const accessToken = await this.handleProperRefreshToken(
              foundUser,
              newRefreshTokenArray,
              res
            );

            return res.status(200).json({ accessToken });
          }
        }
      }
    );
  }

  async flushUserRefreshTokens(refreshToken, res) {
    await jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        // attempted refresh token reuse!
        // console.log('attempted refresh token reuse!')
        await this.removeRefreshTokenCookie(res);

        // stolen refresh token has expired - it is not in database anymore
        if (err) {
          throw new AppError("", 403);
        }

        // stolen refresh token hasn't expired
        await this.userService.updateUser(decoded.id, { refreshToken: [] });
        // console.log(result);
      }
    );
    throw new AppError("", 403);
  }

  async handleFaultyRefreshToken(foundUser, newRefreshTokenArray, res) {
    const result = await this.userService.updateUser(foundUser._id, {
      refreshToken: newRefreshTokenArray,
    });

    await this.removeRefreshTokenCookie(res);
    throw new AppError("Refresh token expired", 401);
  }

  async handleProperRefreshToken(foundUser, newRefreshTokenArray, res) {
    const accessToken = await this.issueAccessToken(foundUser._id.valueOf());

    // console.log("Performing refresh token rotation - handleRefreshToken")
    const newRefreshToken = await this.issueRefreshToken(
      foundUser._id.valueOf()
    );
    // Saving refreshToken with current user
    newRefreshTokenArray = [...newRefreshTokenArray, newRefreshToken];
    const result = await this.userService.updateUser(foundUser._id, {
      refreshToken: newRefreshTokenArray,
    });

    // Creates Secure Cookie with refresh token
    await this.createRefreshTokenCookie(res, newRefreshToken);

    return accessToken;
  }

  async getAccessToken(req) {
    const authHeaders = req.headers.authorization;
    if (!authHeaders || authHeaders === undefined) {
      throw new AppError("No access token provided.", 401);
    }
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      throw new AppError("No access token provided.", 401);
    }

    return token;
  }

  async handleAccessTokenExpiry(token, req, res) {
    await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      async (err, decoded) => {
        if (err) {
          // access token has expired
          const cookies = req.cookies;
          if (!cookies?.refreshToken) {
            throw new AppError("Missing refresh token", 401);
          }
          const refreshToken = cookies.refreshToken;

          await jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET,
            async (err1, decoded1) => {
              if (err1) {
                // refresh token has expired
                const foundUser = await this.userService.getUser({
                  refreshToken: refreshToken,
                });
                // remove expired refresh token from users' database
                let newRefreshTokenArray = foundUser.refreshToken.filter(
                  (rt) => rt !== refreshToken
                );
                await this.handleFaultyRefreshToken(
                  foundUser,
                  newRefreshTokenArray,
                  res
                );
              }
              if (decoded1) {
                // refresh token is still valid
                const foundUser = await this.userService.getUser({
                  refreshToken: refreshToken,
                });
                if (!foundUser) {
                  // this is most likely an attempt of refresh token reuse
                  await this.removeRefreshTokenCookie(res);
                  throw new AppError(
                    "Detected attempted refresh token reuse!",
                    403
                  );
                }

                // remove previous refresh token from users' database (doing refresh token rotation)
                let newRefreshTokenArray = foundUser.refreshToken.filter(
                  (rt) => rt !== refreshToken
                );

                // Issue new access and refresh tokens (and cookie)
                const accessToken = await this.handleProperRefreshToken(
                  foundUser,
                  newRefreshTokenArray,
                  res
                );

                return res.status(200).json({ accessToken: accessToken });
              }
            }
          );
        }
      }
    );
  }

  async createRefreshTokenCookie(res, newRefreshToken) {
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }); // set cookie max age to 30 days
  }

  async removeRefreshTokenCookie(res) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
    });
  }

  //
  async registerUserFromRoute(req, res) {
    // Check if the email already exists in the database
    await this.checkEmailAlreadyUsed(req.body.email);

    // generate new password
    const hashedPassword = await this.generateHashedPassword(req.body.password);

    // create new user with a verification token and send verification mail
    await this.registerNewUser(
      req.body.name,
      req.body.surname,
      req.body.email,
      hashedPassword
    );

    res.status(200).json({
      message: "Registration successful. Check your email for verification.",
    });
  }

  //
  async verifyUserFromRoute(req, res) {
    const userHasAccess = await this.checkUserHasAccess(req);
    if (userHasAccess) {
      await this.verifyUser(req);
      res.status(200).json({ message: "Account has been verified" });
    }
  }

  //
  async forgotPasswordFromRoute(req, res) {
    // Find the user with the given email
    const user = await this.checkUserWithEmailExists(req.body.email);

    await this.generateResetTokenAndSendMail(user);
    res.status(200).json({ message: "Password reset email sent successfully" });
  }

  //
  async resetPasswordFromRoute(req, res) {
    // Find the user with the given reset token
    const user = await this.findUserWithResetToken(req.params.token);

    // Update the user's password and clear the reset token fields
    await this.performPasswordReset(user, req.body.newPassword);

    res.status(200).json({ message: "Password reset successfully" });
  }

  //
  async verifyTokenFromRoute(req, res) {
    // Find the user with the verification token
    const user = await this.findUserWithVerificationToken(req.params.token);

    // Mark the user as verified and remove the verification token
    await this.verifyUserAccount(user);

    res.status(200).json({ message: "Email verified successfully." });
  }

  //
  async loginUserFromRoute(req, res) {
    // find user
    let inputUser = await this.checkUserCredentials(
      req.body.email,
      req.body.password
    );

    // issue access and refresh tokens to logged in user
    const [user, accessToken] = await this.issueAccessRefreshTokens(
      inputUser,
      req,
      res
    );

    // send response
    res.status(200).json({ user, accessToken });
  }

  //
  async logoutUserFromRoute(req, res) {
    // On client, also delete the accessToken
    const status = await this.logoutUser(req, res);
    return res.sendStatus(status);
  }

  // make a function that is called if access token has expired while targeting an endpoint using VerifyToken to check access token validity
  // 1. if refresh token hasn't expired, renew both the access token and refresh token (update refresh token change in database for user)
  // 2. if refresh token has expired, remove refresh token cookie from client and return unauthorized response
  //
  async handleAccessTokenExpiryFromRoute(req, res) {
    const token = await this.getAccessToken(req);

    await this.handleAccessTokenExpiry(token, req, res);
  }

  //
  async handleRefreshTokenFromRoute(req, res) {
    const refreshToken = await this.extractRefreshToken(req);
    const foundUser = await this.getUserByRefreshToken(refreshToken);

    // Detected refresh token reuse! - refresh token has been deleted from database earlier
    if (!foundUser) {
      await this.flushUserRefreshTokens(refreshToken, res);
    }

    const newRefreshTokenArray = foundUser.refreshToken.filter(
      (rt) => rt !== refreshToken
    );

    // handle passed jwt
    await this.handleRefreshToken(
      foundUser,
      refreshToken,
      newRefreshTokenArray,
      res
    );
  }
}

module.exports = AuthService;
