const User = require("../models/User");
const crypto = require("crypto");
const dotenv = require("dotenv");
const {
  getProfileImageSignedUrlS3,
  deleteProfileImageFromS3,
  uploadProfileImageToS3,
} = require("../modules/aws_s3");
const AppError = require("../modules/errorHandling/AppError");
const UserRepository = require("../repositories/users");
const { inject, Scopes } = require("dioma");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

class UserService {
  constructor(userRepository = inject(UserRepository)) {
    this.userRepository = userRepository;
  }
  static scope = Scopes.Singleton();

  async getUser(userData) {
    const user = await this.userRepository.getUserByFields(userData);
    return user;
  }

  async getUserDataById(userId) {
    const user = await this.userRepository.getUserByFields({ _id: userId });

    if (!user) {
      throw new AppError("User with given id doesn't exist", 404);
    }

    const { password, updatedAt, ...userData } = user._doc;

    if (userData.profileImage !== "") {
      userData.profileImage = await getProfileImageSignedUrlS3(
        userData.profileImage,
        user.id
      );
    }

    return userData;
  }

  async checkUserExists(user) {
    if (!user) {
      throw new AppError(
        "There is no existing user connnected with that email address.",
        404
      );
    }
  }

  async checkUserExistsById(userId) {
    const user = await this.userRepository.getUserByFields({ _id: userId });
    if (!user) {
      throw new AppError("User not found.", 404);
    }
    return user;
  }

  async updateUser(userId, userData) {
    const user = await this.userRepository.updateUser(userId, userData);
    return user;
  }

  async updateUserLikedPosts(userId, postId, addLike) {
    const user = await User.findById(userId);
    if (addLike) {
      user.likedPosts = await this.userRepository.performLikePost(
        userId,
        postId
      );
      user.likedPosts.push(postId);
    } else {
      user.likedPosts = await this.userRepository.revertLikePost(
        userId,
        postId
      );
      user.likedPosts = user.likedPosts.filter(
        (pid) => pid.toString() !== postId
      );
    }
    return user.likedPosts;
  }

  async updateUserWithoutImage(req) {
    delete req.body.profileImage;
    const user = await this.userRepository.updateUser(req.params.id, req.body);
    const { password, updatedAt, profileImage, ...userData } = user._doc;
    return userData;
  }

  async deleteUser(userId) {
    await this.userRepository.deleteUser(userId);
  }

  async saveUserWithPendingRegistration(
    name,
    surname,
    email,
    hashedPassword,
    verificationToken
  ) {
    // save user
    await this.userRepository.createUser({
      name: name,
      surname: surname,
      email: email,
      password: hashedPassword,
      verificationToken: verificationToken,
    });
  }

  async checkUserHasAccess(req) {
    if (req.body._id === req.params.id || req.body.isAdmin === "true") {
      return true;
    } else {
      throw new AppError("You can make changes only to your account!", 403);
    }
  }

  async uploadProfileImage(file, userId) {
    const fileName = randomImageName() + "_profile_photo";
    await uploadProfileImageToS3(file, fileName, userId);
    return fileName;
  }

  async deleteOldProfileImage(userId) {
    const user = await this.userRepository.getUserByFields({ _id: userId });
    const oldProfileImage = user.profileImage;
    if (oldProfileImage !== "") {
      await deleteProfileImageFromS3(oldProfileImage, userId);
    }
  }

  async getProfileImage(profileImage, userId) {
    const signedUrl = await getProfileImageSignedUrlS3(profileImage, userId);
    return signedUrl;
  }

  //
  async getUserFromRoute(req, res) {
    const userData = await this.getUserDataById(req.user.id);
    res.status(200).json(userData);
  }

  //
  async getUserByIdFromRoute(req, res) {
    const userData = await this.getUserDataById(req.params.id);
    res.status(200).json(userData);
  }

  //
  async updateUserFromRoute(req, res) {
    const userHasAccess = await this.checkUserHasAccess(req);
    if (userHasAccess) {
      const userData = await this.updateUserWithoutImage(req);
      res.status(200).json(userData);
    }
  }

  //
  async deleteUserFromRoute(req, res) {
    const userHasAccess = await this.checkUserHasAccess(req);
    if (userHasAccess) {
      await this.deleteUser(req.params.id);
      res.status(200).json({ message: "Account has been deleted" });
    }
  }

  //
  async uploadProfileImageFromRoute(req, res) {
    const userHasAccess = await this.checkUserHasAccess(req);
    if (userHasAccess) {
      // upload new profile image
      const fileName = await this.uploadProfileImage(req.file, req.body._id);

      // delete previous profile image (if exists)
      await this.deleteOldProfileImage(req.params.id);

      // Update only the profileImage field in the user object
      const newUser = await this.updateUser(req.params.id, {
        profileImage: fileName,
      });

      if (newUser.profileImage !== "") {
        const signedUrl = await this.getProfileImage(
          newUser.profileImage,
          req.params.id
        );
        res.status(200).json(signedUrl);
      }
    }
  }
}

module.exports = UserService;
