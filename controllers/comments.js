const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const dotenv = require("dotenv");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");
const AppError = require("../modules/errorHandling/AppError");
const CommentService = require("../services/comments");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const commentService = new CommentService();

class CommentsController {
  async createComment(req, res) {
    await commentService.createComment(req.body);
    res.status(200).json({ message: "Comment created successfully." });
  }

  async updateComment(req, res) {
    const newComment = await commentService.updateComment(req);
    res.status(200).json(newComment);
  }

  async deleteComment(req, res) {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      throw new AppError("Comment not found.", 404);
    }
    if (req.body.author !== comment.author.toString()) {
      throw new AppError("You can't delete this comment.", 403);
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Comment deleted successfully." });
  }

  async getComments(req, res) {
    //get all the posts from that user
    const posts = await Post.find({ userId: req.params.id });
    const postIds = posts?.map((post) => post._id);
    if (!postIds || postIds.length === 0) {
      throw new AppError("Posts not found.", 404);
    }
    const comments = await Comment.find({ post: { $in: postIds } })
      .populate({
        path: "author",
        select: "name surname profileImage",
      })
      .exec();

    // Loop through comments and update profileImage URLs
    for (const comment of comments) {
      if (comment.author && comment.author.profileImage !== "") {
        comment.author.profileImage = await getProfileImageSignedUrlS3(
          comment.author.profileImage,
          comment.author.toString()
        );
      }
    }

    res.status(200).json(comments);
  }
}

module.exports = CommentsController;
