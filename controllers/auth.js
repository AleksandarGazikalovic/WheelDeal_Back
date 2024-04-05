const AuthService = require("../services/auth");

const authService = new AuthService();

class AuthController {
  //
  async registerUser(req, res) {
    // Check if the email already exists in the database
    await authService.checkEmailAlreadyUsed(req.body.email);

    // generate new password
    const hashedPassword = await authService.generateHashedPassword(
      req.body.password
    );

    // create new user with a verification token and send verification mail
    await authService.registerNewUser(
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
  async verifyUser(req, res) {
    const userHasAccess = await authService.checkUserHasAccess(req);
    if (userHasAccess) {
      await authService.verifyUser(req);
      res.status(200).json({ message: "Account has been verified" });
    }
  }

  //
  async forgotPassword(req, res) {
    // Find the user with the given email
    const user = await authService.checkUserWithEmailExists(req.body.email);

    await authService.generateResetTokenAndSendMail(user);
    res.status(200).json({ message: "Password reset email sent successfully" });
  }

  //
  async resetPassword(req, res) {
    // Find the user with the given reset token
    const user = await authService.findUserWithResetToken(req.params.token);

    // Update the user's password and clear the reset token fields
    await authService.performPasswordReset(user, req.body.newPassword);

    res.status(200).json({ message: "Password reset successfully" });
  }

  //
  async verifyToken(req, res) {
    // Find the user with the verification token
    const user = await authService.findUserWithVerificationToken(
      req.params.token
    );

    // Mark the user as verified and remove the verification token
    await authService.verifyUserAccount(user);

    res.status(200).json({ message: "Email verified successfully." });
  }

  //
  async loginUser(req, res) {
    // find user
    let inputUser = await authService.checkUserCredentials(
      req.body.email,
      req.body.password
    );

    // issue access and refresh tokens to logged in user
    const [user, accessToken] = await authService.issueAccessRefreshTokens(
      inputUser,
      req,
      res
    );

    // send response
    res.status(200).json({ user, accessToken });
  }

  //
  async logoutUser(req, res) {
    // On client, also delete the accessToken
    const status = await authService.logoutUser(req, res);
    return res.sendStatus(status);
  }

  // make a function that is called if access token has expired while targeting an endpoint using VerifyToken to check access token validity
  // 1. if refresh token hasn't expired, renew both the access token and refresh token (update refresh token change in database for user)
  // 2. if refresh token has expired, remove refresh token cookie from client and return unauthorized response
  //
  async handleAccessTokenExpiry(req, res) {
    const token = await authService.getAccessToken(req);

    await authService.handleAccessTokenExpiry(token, req, res);
  }

  //
  async handleRefreshToken(req, res) {
    const refreshToken = await authService.extractRefreshToken(req);
    const foundUser = await authService.getUserByRefreshToken(refreshToken);

    // Detected refresh token reuse! - refresh token has been deleted from database earlier
    if (!foundUser) {
      await authService.flushUserRefreshTokens(refreshToken, res);
    }

    const newRefreshTokenArray = foundUser.refreshToken.filter(
      (rt) => rt !== refreshToken
    );

    // handle passed jwt
    await authService.handleRefreshToken(
      foundUser,
      refreshToken,
      newRefreshTokenArray,
      res
    );
  }
}

module.exports = AuthController;
