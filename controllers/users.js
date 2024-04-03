const dotenv = require("dotenv");
const UserService = require("../services/users");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const userService = new UserService();

class UsersController {
  //
  async getUser(req, res) {
    const userData = await userService.getUserDataById(req.user.id);
    res.status(200).json(userData);
  }

  //
  async getUserById(req, res) {
    const userData = await userService.getUserDataById(req.params.id);
    res.status(200).json(userData);
  }

  //
  async updateUser(req, res) {
    const userHasAccess = await userService.checkUserHasAccess(req);
    if (userHasAccess) {
      const userData = await userService.updateUserWithoutImage(req);
      res.status(200).json(userData);
    }
  }

  //
  async deleteUser(req, res) {
    const userHasAccess = await userService.checkUserHasAccess(req);
    if (userHasAccess) {
      await userService.deleteUser(req.params.id);
      res.status(200).json({ message: "Account has been deleted" });
    }
  }

  async uploadProfileImage(req, res) {
    const userHasAccess = await userService.checkUserHasAccess(req);
    if (userHasAccess) {
      // upload new profile image
      const fileName = await userService.uploadProfileImage(
        req.file,
        req.body._id
      );

      // delete previous profile image (if exists)
      await userService.deleteOldProfileImage(req.params.id);

      // Update only the profileImage field in the user object
      const newUser = await userService.updateUser(req.params.id, {
        profileImage: fileName,
      });

      if (newUser.profileImage !== "") {
        const signedUrl = await userService.getProfileImage(
          newUser.profileImage,
          req.params.id
        );
        res.status(200).json(signedUrl);
      }
    }
  }
}

module.exports = UsersController;
