const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const dotenv = require("dotenv");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");
const AppError = require("../modules/errorHandling/AppError");
const CommentRepository = require("../repositories/comments");
const UserService = require("./users");
const PostService = require("./posts");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const commentRepository = new CommentRepository();
const userService = new UserService();
const postService = new PostService();

class CommentService {
  async createComment(commentData) {
    // Check if the user and post exist
    const user = await userService.checkUserExistsById(commentData.author);
    const post = await postService.checkPostExistsById(commentData.post);

    // Check if the author is the same as the post owner
    if (commentData.author === post.userId) {
      throw new AppError("You can't comment your own post.", 403);
    }

    // //TODO - Uncomment the following code when the payment system is implemented
    // //Check if transaction is completed before commenting
    // if (!req.body.paymentId) {
    //   return res
    //     .status(403)
    //     .json({message: "Complete transaction is required for commenting."});
    // }

    // //check if the payment exists
    // const payment = await Payment.findById(req.body.paymentId)
    // if (!payment) {
    //   return res.status(404).json({message: "Payment not found."});
    // }

    // check if the rating is missing
    if (!commentData.rating) {
      throw new AppError("Rating is required.", 400);
    }
    const comment = await commentRepository.createComment(commentData);
    return comment;
  }

  async checkCommentExistsById(commentId) {
    const comment = await commentRepository.getCommentByFields({
      _id: commentId,
    });
    if (!comment) {
      throw new AppError("Comment not found.", 404);
    }
    return comment;
  }

  async updateComment(req) {
    const comment = await this.checkCommentExistsById(req.params.id);

    if (req.body.author !== comment.author.toString()) {
      throw new AppError("You can't update this comment.", 403);
    }

    const newComment = await commentRepository.updateComment(req.params.id, {
      rating: req.body.rating,
      content: req.body.content,
    });
    return newComment;
  }
}

module.exports = CommentService;
