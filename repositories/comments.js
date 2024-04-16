const { Scopes } = require("dioma");
const Comment = require("../models/Comment");

class CommentRepository {
  // Single instance of the class for the entire application
  static scope = Scopes.Singleton();

  // create comment with given fields
  async createComment(commentData) {
    const newComment = new Comment(commentData);
    await newComment.save();
    return newComment;
  }

  // find comment by id and update that comment with given parameters
  async updateComment(commentId, commentData) {
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      commentData,
      { new: true } // This option returns the updated document
    );
    return updatedComment;
  }

  // find comment using any fields and their values
  async getCommentByFields(searchData) {
    const foundComment = await Comment.findOne(searchData);
    return foundComment;
  }

  // find all comments by matching criteria
  async getAllCommentsByFields(searchData) {
    const foundComments = await Comment.find({ ...searchData }).populate({
      path: "author",
      select: "name surname profileImage",
    });
    return foundComments;
  }

  // find comment by id and delete that comment
  async deleteComment(commentId) {
    await Comment.findByIdAndDelete(commentId);
  }
}

module.exports = CommentRepository;
