const { Scopes } = require("dioma");
const User = require("../models/User");

class UserRepository {
  // Single instance of the class for the entire application
  static scope = Scopes.Singleton();

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
    // updating must be done this way because if you use any update variant it will ommit "undefined" values
    const user = await User.findOne({ _id: userId });
    for (let field in userData) {
      user[field] = userData[field];
    }
    const updatedUser = await user.save();
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
