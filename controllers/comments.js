const CommentService = require("../services/comments");

const commentService = new CommentService();

class CommentsController {
  //
  async createComment(req, res) {
    await commentService.createComment(req.body);
    res.status(200).json({ message: "Comment created successfully." });
  }

  //
  async updateComment(req, res) {
    const newComment = await commentService.updateComment(req);
    res.status(200).json(newComment);
  }

  //
  async deleteComment(req, res) {
    await commentService.deleteComment(req);
    res.status(200).json({ message: "Comment deleted successfully." });
  }

  //
  async getComments(req, res) {
    //get all the posts from that user
    let comments = await commentService.getComments(req);

    // Loop through comments and update profileImage URLs
    comments = await commentService.getCommentsWithUserProfileImages(comments);
    res.status(200).json(comments);
  }
}

module.exports = CommentsController;
