const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

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

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadImagesToS3 = async (files) => {
  const imageKeys = [];

  for (const file of files) {
    const imageName = randomImageName();
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Body: file.buffer,
      Key: imageName,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    imageKeys.push(imageName);
  }

  return imageKeys;
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = req.headers.authorization?.split(" ")[1];
  if (!authHeader || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // add logic to detect if someone tampered with access token
    if (err) {
      if (err.name == "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      } else {
        return res.status(401).json({
          message: "Unauthorized, token signature usuccessfuly verified",
        });
      }
    }
    req.user = decoded;
    next();
  });
};

//create a post
router.post(
  "/",
  upload.array("images[]", 10),
  verifyToken,
  async (req, res) => {
    try {
      const imageKeys = await uploadImagesToS3(req.files);

      const newPost = new Post({
        images: imageKeys,
        ...req.body,
      });

      const savedPost = await newPost.save();

      const updatedImages = [];

      for (let i = 0; i < savedPost.images.length; i++) {
        const getObjectParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: savedPost.images[i],
        };

        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
router.put("/:id", upload.array("images[]", 10), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      let imageKeys = [];
      if (req.files && req.files.length > 0) {
        imageKeys = await uploadImagesToS3(req.files);
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
        const getObjectParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: updatedPost.images[i],
        };

        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
});

//delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      try {
        await Post.findByIdAndDelete(req.params.id);
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
router.put("/:id/like", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const user = await User.findById(req.body.userId);
    if (!user.likedPosts.includes(post._id)) {
      try {
        await user.updateOne({ $push: { likedPosts: post._id.toString() } });
        res.status(200).json(user.likedPosts);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    } else {
      try {
        await user.updateOne({ $pull: { likedPosts: post._id.toString() } });
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
    const post = await Post.findById(req.params.id);
    const updatedImages = [];
    for (let i = 0; i < post.images.length; i++) {
      const getObjectParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: post.images[i],
      };
      const command = new GetObjectCommand(getObjectParams);
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
    const posts = await Post.find({ userId: req.params.id });
    const imagePromises = posts.map(async (post) => {
      const updatedImages = [];

      for (let i = 0; i < post.images.length; i++) {
        const getObjectParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: post.images[i],
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
    console.log(user.likedPosts);

    // Filter out deleted posts from likedPosts
    const validLikedPosts = await Promise.all(
      user.likedPosts.map(async (postId) => {
        const post = await Post.findById(postId);
        return post !== null ? postId : null;
      })
    );

    // Remove null entries (deleted posts) from the array
    user.likedPosts = validLikedPosts.filter((postId) => postId !== null);
    console.log(user.likedPosts);

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
        const getObjectParams = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: post.images[i],
        };
        const command = new GetObjectCommand(getObjectParams);
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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
          const getObjectParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: post.images[i],
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
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

      const posts = await Post.find()
        .skip((page - 1) * limit)
        .limit(limit);

      const imagePromises = posts.map(async (post) => {
        const updatedImages = [];

        for (let i = 0; i < post.images.length; i++) {
          const getObjectParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: post.images[i],
          };
          const command = new GetObjectCommand(getObjectParams);
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
          updatedImages.push(url);
        }
        post.images = updatedImages;
        return post;
      });
      const updatedPosts = await Promise.all(imagePromises);

      const hasMore = page * limit < totalPosts;

      res.status(200).json({ posts: updatedPosts, hasMore });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
