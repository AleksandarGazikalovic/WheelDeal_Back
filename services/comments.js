const dotenv = require("dotenv");
const { getProfileImageSignedUrlS3 } = require("../modules/aws_s3");

const AppError = require("../modules/errorHandling/AppError");
const dependencyContainer = require("../modules/dependencyContainer");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

class CommentService {
  constructor(
    commentRepository = dependencyContainer.getDependency("commentRepository"),
    userService = dependencyContainer.getDependency("userService"),
    postService = dependencyContainer.getDependency("postService")
  ) {
    // console.log("Initializing comment service...");
    this.commentRepository = commentRepository;
    this.userService = userService;
    this.postService = postService;
    dependencyContainer.register("commentService", this);
  }

  async getCommentsWithUserProfileImages(comments) {
    for (const comment of comments) {
      if (comment.author && comment.author.profileImage !== "") {
        comment.author.profileImage = await getProfileImageSignedUrlS3(
          comment.author.profileImage,
          comment.author._id
        );
      }
    }
    return comments;
  }

  async createComment(commentData) {
    // Check if the user and post exist
    const user = await this.userService.checkUserExistsById(commentData.author);
    const post = await this.postService.checkPostExistsById(commentData.post);

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
    const comment = await this.commentRepository.createComment(commentData);
    return comment;
  }

  async checkCommentExistsById(commentId) {
    const comment = await this.commentRepository.getCommentByFields({
      _id: commentId,
    });
    if (!comment) {
      throw new AppError("Comment not found.", 404);
    }
    return comment;
  }

  async checkCanChangeComment(comment, author) {
    if (author !== comment.author.toString()) {
      throw new AppError("You can't make changes to this comment.", 403);
    }
  }

  async updateComment(req) {
    const comment = await this.checkCommentExistsById(req.params.id);
    await this.checkCanChangeComment(comment, req.body.author);

    const newComment = await this.commentRepository.updateComment(
      req.params.id,
      {
        rating: req.body.rating,
        content: req.body.content,
      }
    );
    return newComment;
  }

  async getComments(req) {
    const posts = await this.postService.getPosts({ userId: req.params.id });
    const postIds = posts.map((post) => post._id);
    if (postIds.length === 0) {
      throw new AppError("Posts not found.", 404);
    }
    const comments = await this.commentRepository.getAllCommentsByFields({
      post: { $in: postIds },
    });
    return comments;
  }

  async deleteComment(req) {
    const comment = await this.checkCommentExistsById(req.params.id);
    await this.checkCanChangeComment(comment, req.body.author);
    await this.commentRepository.deleteComment(req.params.id);
  }

  //
  async createCommentFromRoute(req, res) {
    await this.createComment(req.body);
    res.status(200).json({ message: "Comment created successfully." });
  }

  //
  async updateCommentFromRoute(req, res) {
    const newComment = await this.updateComment(req);
    res.status(200).json(newComment);
  }

  //
  async deleteCommentFromRoute(req, res) {
    await this.deleteComment(req);
    res.status(200).json({ message: "Comment deleted successfully." });
  }

  //
  async getCommentsFromRoute(req, res) {
    //get all the posts from that user
    let comments = await this.getComments(req);

    // Loop through comments and update profileImage URLs
    comments = await this.getCommentsWithUserProfileImages(comments);
    res.status(200).json(comments);
  }
}

module.exports = CommentService;
