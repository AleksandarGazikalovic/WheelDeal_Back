const Comment = require("../models/Comment");

class CommentRepository {
  // create comment with given fields
  async createComment(commentData) {
    const newComment = new Comment(commentData);
    await newComment.save();
    return newComment;
  }

  // find comment by id and update that comment with given parameters
  async updateComment(commentId, commentData) {
    // updating must be done this way because if you use any update variant it will ommit "undefined" values
    const comment = await Comment.findOne({ _id: commentId });
    for (let field in commentData) {
      comment[field] = commentData[field];
    }
    const updatedComment = await comment.save();
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
