const router = require("express").Router();
const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const dotenv = require("dotenv");
const { getImageSignedUrlS3 } = require("../modules/aws_s3");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

// Create a comment
router.post("/", async (req, res) => {
  // Check if the user exists
  const user = await User.findById(req.body.author);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Check if the post exists
  const post = await Post.findById(req.body.post);
  if (!post) {
    return res.status(404).json({ message: "Post not found." });
  }

  // Check if the author is the same as the post owner
  if (req.body.author === post.userId) {
    return res
      .status(403)
      .json({ message: "You can't comment your own post." });
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
    return res.status(403).json({ message: "Rating is required." });
  }

  const newComment = new Comment(req.body);
  try {
    await newComment.save();
    res.status(200).json({ message: "Comment created successfully." });
  } catch (err) {
    res.status(500).json(err);
  }
});

// Fetch all comments for a post related to a user
router.get("/:id", async (req, res) => {
  try {
    //get all the posts from that user
    const posts = await Post.find({ userId: req.params.id });
    const postIds = posts?.map((post) => post._id);
    if (!postIds || postIds.length === 0) {
      return res.status(404).json({ message: "Posts not found." });
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
        comment.author.profileImage = await getImageSignedUrlS3(
          comment.author.profileImage
        );
      }
    }

    res.status(200).json(comments);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update a comment
router.put("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }

    if (req.body.author !== comment.author.toString()) {
      return res
        .status(403)
        .json({ message: "You can't update this comment." });
    }

    newComment = await Comment.findByIdAndUpdate(
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
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

// Delete a comment
router.delete("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }
    if (req.body.author !== comment.author) {
      return res
        .status(403)
        .json({ message: "You can't delete this comment." });
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Comment deleted successfully." });
  } catch (err) {
    res.status(500).json(err);
  }
});

module.exports = router;
