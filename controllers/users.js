const User = require("../models/User");
const multer = require("multer");
const crypto = require("crypto");
const dotenv = require("dotenv");
const {
  getProfileImageSignedUrlS3,
  deleteProfileImageFromS3,
  uploadProfileImageToS3,
} = require("../modules/aws_s3");
const AppError = require("../modules/errorHandling/AppError");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

class UsersController {
  async getUser(req, res) {
    const user = await User.findById(req.user.id);
    const { password, updatedAt, ...other } = user._doc;
    const profileImage = other.profileImage;

    if (profileImage !== "") {
      other.profileImage = await getProfileImageSignedUrlS3(
        profileImage,
        req.user.id
      );
    }
    console.log(user.updatedAt);
    res.status(200).json(other);
  }

  async getUserById(req, res) {
    const user = await User.findById(req.params.id);
    const { password, updatedAt, ...other } = user._doc;
    const profileImage = other.profileImage;

    if (profileImage !== "") {
      other.profileImage = await getProfileImageSignedUrlS3(
        profileImage,
        req.params.id
      );
    }
    res.status(200).json(other);
  }

  async updateUser(req, res) {
    if (req.body._id === req.params.id || req.body.isAdmin === "true") {
      delete req.body.profileImage;
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      );
      const { password, updatedAt, profileImage, ...other } = user._doc;
      res.status(200).json(other);
    } else {
      throw new AppError("You can update only your account!", 403);
    }
  }

  async deleteUser(req, res) {
    if (req.body._id === req.params.id || req.body.isAdmin === "true") {
      const user = await User.findByIdAndDelete(req.params.id);
      res.status(200).json({ message: "Account has been deleted" });
    } else {
      throw new AppError("You can delete only your account!", 403);
    }
  }

  async uploadProfileImage(req, res) {
    if (req.body._id === req.params.id || req.body.isAdmin === "true") {
      const file = req.file;
      const fileName = randomImageName() + "_profile_photo";
      await uploadProfileImageToS3(file, fileName, req.body._id);

      let user = await User.findById(req.params.id);
      const oldProfileImage = user.profileImage;
      if (oldProfileImage !== "") {
        await deleteProfileImageFromS3(oldProfileImage, req.params.id);
      }
      // Update only the profileImage field in the user object
      user = await User.findByIdAndUpdate(
        req.params.id,
        { profileImage: fileName },
        { new: true } // This option returns the updated document
      );

      if (user.profileImage !== "") {
        const signedUrl = await getProfileImageSignedUrlS3(
          user.profileImage,
          req.params.id
        );
        res.status(200).json(signedUrl);
      }
    } else {
      throw new AppError("You can update only your account!", 403);
    }
  }
}

module.exports = UsersController;
