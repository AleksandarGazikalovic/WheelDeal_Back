const router = require("express").Router();
const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
  if (req.body.author === req.body.post) {
    return res
      .status(403)
      .json({ message: "You can't comment your own post." });
  }

  // //TODO - Uncomment the following code when the payment system is implemented
  // //Check if transaction is completed before commenting
  // if (!req.body.paymentId) {
  //   return res
  //     .status(403)
  //     .json({ message: "Complete transaction is required for commenting." });
  // }

  // //check if the payment exists
  // const payment = await Payment.findById(req.body.paymentId)
  // if (!payment) {
  //   return res.status(404).json({ message: "Payment not found." });
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
    const postIds = await Post.find({ userId: req.params.id }).select("_id");

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
        const command = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: comment.author.profileImage,
        });

        const signedUrl = await getSignedUrl(s3, command, {
          expiresIn: 3600,
        });

        comment.author.profileImage = signedUrl;
      }
    }

    res.status(200).json(comments);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: err.message });
  }
});

// Update a comment
router.put("/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found." });
    }

    if (req.user.id !== comment.author.toString()) {
      return res
        .status(403)
        .json({ message: "You can't update this comment." });
    }

    await Comment.findByIdAndUpdate(req.params.id, {
      $set: {
        rating: req.body.rating,
        content: req.body.content,
      },
    });
    res.status(200).json({ message: "Comment updated successfully." });
  } catch (err) {
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

    if (req.user.id !== comment.author.toString()) {
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
