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

dotenv.config();

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

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = req.headers.authorization?.split(" ")[1];
  if (!authHeader || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => { // add logic to detect if someone tampered with access token
    if (err) {
      if (err.name == "TokenExpiredError") {
        return res.status(401).json({ message: "Access token expired" });
      } else {
        return res.status(401).json({ message: "Unauthorized, token signature usuccessfuly verified" });
      }
    }
    req.user = decoded;
    next();
  });
};

//create a post
router.post("/", upload.array("images[]", 10), verifyToken, async (req, res) => {
  try {
    const imageKeys = [];

    req.files.forEach((file) => {
      const imageName = randomImageName();
      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Body: file.buffer,
        Key: imageName,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(uploadParams);
      s3.send(command);

      imageKeys.push(imageName);
    });
    const newPost = new Post({
      images: imageKeys,
      ...req.body,
    });
    const savedPost = await newPost.save();

    res.status(200).json(savedPost);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
});

//update a post
router.put("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      try {
        const updatedPost = await Post.findByIdAndUpdate(
          req.params.id,
          {
            $set: req.body,
          },
          { new: true }
        );
        res.status(200).json(updatedPost);
      } catch (err) {
        res.status(500).json(err);
      }
    } else {
      res.status(401).json("You can update only your post!");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});

//delete a post
router.delete("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      try {
        await post.delete();
        res.status(200).json("Post has been deleted...");
      } catch (err) {
        res.status(500).json(err);
      }
    } else {
      res.status(401).json("You can only delete your post!");
    }
  } catch (err) {
    res.status(500).json(err);
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
        console.log(user);
        res.status(200).json(user.likedPosts);
        console.log(user);
      } catch (err) {
        res.status(500).json(err);
        console.log(err);
      }
    } else {
      try {
        await user.updateOne({ $pull: { likedPosts: post._id.toString() } });
        console.log(user);
        res.status(200).json(user.likedPosts);
        console.log(user);
      } catch (err) {
        res.status(500).json(err);
        console.log(err);
      }
    }
  } catch (err) {
    res.status(500).json(err);
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
    res.status(500).json(err);
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
    res.status(500).json(err);
  }
});

//get all liked posts
router.get("/liked/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
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
    res.status(500).json(err);
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
    res.status(500).json(err);
  }
});

module.exports = router;
