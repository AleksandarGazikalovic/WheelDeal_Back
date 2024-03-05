const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const multer = require("multer");
const dotenv = require("dotenv");

const {
  uploadPostImagesToS3,
  getPostImageSignedUrlS3,
} = require("../modules/aws_s3");
const { verifyToken } = require("../middleware/auth");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

//create a post
router.post(
  "/",
  upload.array("images[]", 10),
  verifyToken,
  async (req, res) => {
    try {
      let newPost = new Post({
        ...req.body,
      });
      let savedPost = await newPost.save();

      const imageKeys = await uploadPostImagesToS3(
        req.files,
        req.body.userId,
        savedPost.id
      );

      savedPost = await Post.findByIdAndUpdate(
        savedPost.id,
        {
          images: imageKeys,
          ...req.body,
        },
        { new: true }
      );

      const updatedImages = [];
      for (let i = 0; i < savedPost.images.length; i++) {
        const url = await getPostImageSignedUrlS3(
          savedPost.images[i],
          req.body.userId,
          savedPost.id
        );
        updatedImages.push(url);
      }
      savedPost.images = updatedImages;

      res.status(200).json(savedPost);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

//update a post
router.put(
  "/:id",
  upload.array("images[]", 10),
  verifyToken,
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (post.userId === req.body.userId) {
        let imageKeys = [];
        if (req.files && req.files.length > 0) {
          imageKeys = await uploadPostImagesToS3(
            req.files,
            req.body.userId,
            req.params.id
          );
        } else {
          imageKeys = post.images;
        }
        const updatedPost = await Post.findByIdAndUpdate(
          req.params.id,
          {
            images: imageKeys,
            ...req.body,
          },
          { new: true }
        );

        const updatedImages = [];

        for (let i = 0; i < updatedPost.images.length; i++) {
          const url = await getPostImageSignedUrlS3(
            updatedPost.images[i],
            req.body.userId,
            updatedPost.id
          );
          updatedImages.push(url);
        }

        updatedPost.images = updatedImages;

        res.status(200).json(updatedPost);
      } else {
        res.status(401).json({ message: "You can only update your post!" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

//delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      try {
        //await Post.findByIdAndDelete(req.params.id);
        await Post.findByIdAndUpdate(post.id, {
          isArchived: true,
        });
        // TODO: delete post images from s3 bucket
        res.status(200).json({ message: "Post has been deleted!" });
      } catch (err) {
        res.status(500).json(err);
      }
    } else {
      res.status(401).json({ message: "You can only delete your post!" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//like a post
router.put("/:id/like", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    let user = await User.findById(req.body.userId);
    if (!user.likedPosts.includes(post._id)) {
      try {
        await user.updateOne({ $push: { likedPosts: post._id.toString() } });
        user.likedPosts.push(post._id.toString());
        res.status(200).json(user.likedPosts);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    } else {
      try {
        await user.updateOne({ $pull: { likedPosts: post._id.toString() } });
        user.likedPosts = user.likedPosts.filter(
          (pid) => pid.toString() !== post._id.toString()
        );
        res.status(200).json(user.likedPosts);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
    console.log(err);
  }
});

//get a post
router.get("/:id", async (req, res) => {
  try {
    //console.log(req.params.id);
    const post = (
      await Post.find({ _id: req.params.id, isArchived: false })
    )[0];
    //console.log(post);
    if (post == null) {
      return res.status(404).json({ message: "Post can't be found" });
    }
    const updatedImages = [];
    for (let i = 0; i < post.images.length; i++) {
      const url = await getPostImageSignedUrlS3(
        post.images[i],
        post.userId,
        post.id
      );
      updatedImages.push(url);
    }
    post.images = updatedImages;
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get all user posts
router.get("/profile/:id", async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.id, isArchived: false });
    const imagePromises = posts.map(async (post) => {
      const updatedImages = [];

      for (let i = 0; i < post.images.length; i++) {
        const url = await getPostImageSignedUrlS3(
          post.images[i],
          req.params.id,
          post.id
        );
        updatedImages.push(url);
      }
      post.images = updatedImages;
      return post;
    });
    const updatedPosts = await Promise.all(imagePromises);
    res.status(200).json(updatedPosts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get all liked posts
router.get("/liked/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    // Filter out deleted posts from likedPosts
    const validLikedPosts = await Promise.all(
      user.likedPosts.map(async (postId) => {
        const post = await Post.findById(postId);
        return post !== null && post.isArchived === false ? postId : null;
      })
    );

    // Remove null entries (deleted posts) from the array
    user.likedPosts = validLikedPosts.filter((postId) => postId !== null);

    // Save the updated likedPosts array
    await user.save();

    const posts = await Promise.all(
      user.likedPosts.map((postId) => {
        return Post.findById(postId);
      })
    );
    const imagePromises = posts.map(async (post) => {
      const updatedImages = [];

      for (let i = 0; i < post.images.length; i++) {
        const url = await getPostImageSignedUrlS3(
          post.images[i],
          post.userId,
          post.id
        );
        updatedImages.push(url);
      }
      post.images = updatedImages;
      return post;
    });
    const updatedPosts = await Promise.all(imagePromises);
    res.status(200).json(updatedPosts);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//filter posts by date and price
router.get("/filter/all", async (req, res) => {
  try {
    // Create an array to store filter conditions
    const filters = [];
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;

    // Step 2: Start Date Filters
    if (
      req.query.startDate &&
      req.query.startDate !== "" &&
      req.query.startDate !== "undefined"
    ) {
      filters.push({
        $match: {
          from: { $gte: new Date(req.query.startDate) },
        },
      });
    }

    // Step 3: End Date Filters
    if (
      req.query.endDate &&
      req.query.endDate !== "" &&
      req.query.endDate !== "undefined"
    ) {
      filters.push({
        $match: {
          to: { $lte: new Date(req.query.endDate) },
        },
      });
    }

    // Step 4: Start Price Filters
    if (
      req.query.startPrice &&
      req.query.startPrice !== "" &&
      req.query.startPrice !== "undefined"
    ) {
      filters.push({
        $match: {
          price: {
            $gte: parseFloat(req.query.startPrice),
          },
        },
      });
    }

    // Step 5: End Price Filters
    if (
      req.query.endPrice &&
      req.query.endPrice !== "" &&
      req.query.endPrice !== "undefined"
    ) {
      filters.push({
        $match: {
          price: {
            $lte: parseFloat(req.query.endPrice),
          },
        },
      });
    }

    // Step 4: Location and Brand Filters
    if (
      req.query.location &&
      req.query.location !== "" &&
      req.query.location !== "undefined"
    ) {
      filters.push({
        $match: {
          "location.address": { $regex: req.query.location, $options: "i" },
        },
      });
    }

    if (
      req.query.brand &&
      req.query.brand !== "" &&
      req.query.brand !== "undefined"
    ) {
      filters.push({
        $match: {
          brand: { $regex: req.query.brand, $options: "i" },
        },
      });
    }
    //if there are filters, aggregate the posts
    if (filters.length > 0) {
      filters.push({
        $match: {
          isArchived: {
            $eq: false,
          },
        },
      });
      const aggregationPipeline = filters;
      const totalFilteredPosts = await Post.countDocuments({
        $and: aggregationPipeline.map((filter) => filter.$match),
      });

      const posts = await Post.aggregate(aggregationPipeline)
        .skip((page - 1) * limit)
        .limit(limit);

      const imagePromises = posts.map(async (post) => {
        const updatedImages = [];

        for (let i = 0; i < post.images.length; i++) {
          const url = await getPostImageSignedUrlS3(
            post.images[i],
            post.userId,
            post._id.toString()
          );
          updatedImages.push(url);
        }
        post.images = updatedImages;
        return post;
      });
      const updatedPosts = await Promise.all(imagePromises);

      const hasMore = page * limit < totalFilteredPosts;

      res.status(200).json({ posts: updatedPosts, hasMore });
    } else {
      //if there are no filters, return all posts
      const totalPosts = await Post.countDocuments();

      const posts = await Post.find({ isArchived: false })
        .skip((page - 1) * limit)
        .limit(limit);
      const imagePromises = posts.map(async (post) => {
        const updatedImages = [];

        for (let i = 0; i < post.images.length; i++) {
          const url = await getPostImageSignedUrlS3(
            post.images[i],
            post.userId,
            post.id
          );
          updatedImages.push(url);
        }
        post.images = updatedImages;
        return post;
      });
      const updatedPosts = await Promise.all(imagePromises);
      // console.log(page * limit);
      // console.log(totalPosts);
      const hasMore = page * limit < totalPosts;
      // console.log(hasMore);

      res.status(200).json({ posts: updatedPosts, hasMore });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
