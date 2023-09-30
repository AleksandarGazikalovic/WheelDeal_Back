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

//create a post
router.post("/", upload.array("images[]", 10), async (req, res) => {
  console.log(req.body);
  console.log(req.files);
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
        await user.updateOne({ $push: { likedPosts: post._id } });
        res.status(200).json("The post has been liked");
      } catch (err) {
        res.status(500).json(err);
        console.log(err);
      }
    } else {
      try {
        await user.updateOne({ $pull: { likedPosts: post._id } });
        res.status(200).json("The post has been disliked");
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
    console.log(req.query);

    // Step 2: Date Filters
    if (
      req.query.startDate !== "" &&
      req.query.endDate !== "" &&
      req.query.startDate !== "undefined" &&
      req.query.endDate !== "undefined"
    ) {
      console.log("date");
      filters.push({
        $match: {
          from: { $gte: new Date(req.query.startDate) },
          to: { $lte: new Date(req.query.endDate) },
        },
      });
    }

    // Step 3: Price Filters
    if (
      req.query.startPrice !== "" &&
      req.query.endPrice !== "" &&
      req.query.startPrice !== "undefined" &&
      req.query.endPrice !== "undefined"
    ) {
      console.log("price");
      filters.push({
        $match: {
          price: {
            $gte: parseFloat(req.query.startPrice),
            $lte: parseFloat(req.query.endPrice),
          },
        },
      });
    }

    // Step 4: Location and Model Filters
    if (req.query.location !== "" && req.query.location !== "undefined") {
      console.log("location");
      filters.push({
        $match: {
          location: { $regex: req.query.location, $options: "i" },
        },
      });
    }

    if (req.query.model !== "" && req.query.model !== "undefined") {
      console.log("model");
      filters.push({
        $match: {
          model: { $regex: req.query.model, $options: "i" },
        },
      });
    }
    //if there are filters, aggregate the posts
    if (filters.length > 0) {
      const aggregationPipeline = filters;
      const posts = await Post.aggregate(aggregationPipeline);

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
    } else {
      //if there are no filters, return all posts
      const posts = await Post.find();

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
    }
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

module.exports = router;
