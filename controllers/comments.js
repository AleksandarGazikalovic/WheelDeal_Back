const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const dotenv = require("dotenv");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");
const AppError = require("../modules/errorHandling/AppError");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

class CommentsController {
  async createComment(req, res) {
    // Check if the user exists
    const user = await User.findById(req.body.author);
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // Check if the post exists
    const post = await Post.findById(req.body.post);
    if (!post) {
      throw new AppError("Post not found.", 404);
    }

    // Check if the author is the same as the post owner
    if (req.body.author === post.userId) {
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
    if (!req.body.rating) {
      throw new AppError("Rating is required.", 400);
    }

    const newComment = new Comment(req.body);
    await newComment.save();

    res.status(200).json({ message: "Comment created successfully." });
  }

  async updateComment(req, res) {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      throw new AppError("Comment not found.", 404);
    }

    if (req.body.author !== comment.author.toString()) {
      throw new AppError("You can't update this comment.", 403);
    }

    const newComment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          rating: req.body.rating,
          content: req.body.content,
        },
      },
      { new: true }
    );
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
