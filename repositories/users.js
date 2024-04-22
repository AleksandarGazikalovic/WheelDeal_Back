const User = require("../models/User");
const dependencyContainer = require("../modules/dependencyContainer");

class UserRepository {
  constructor() {
    dependencyContainer.register("userRepository", this);
  }

  // create user with given fields
  async createUser(userData) {
    const newUser = new User(userData);
    await newUser.save();
    return newUser;
  }

  // find user using any fields and their values
  async getUserByFields(searchData) {
    const foundUser = await User.findOne(searchData);
    return foundUser;
  }

  // find user by id and update that user with given parameters
  async updateUser(userId, userData) {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      userData,
      { new: true } // This option returns the updated document
    );
    return updatedUser;
  }

  // find user by id and delete that user
  async deleteUser(userId) {
    await User.findByIdAndDelete(userId);
  }

  async performLikePost(userId, postId) {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      {
        $push: { likedPosts: postId },
      },
      { new: true }
    );
    return user.likedPosts;
  }

  async revertLikePost(userId, postId) {
    const user = await User.findOneAndUpdate(
      { _id: userId },
      {
        $pull: { likedPosts: postId },
      },
      { new: true }
    );
    return user.likedPosts;
  }
}

module.exports = UserRepository;
