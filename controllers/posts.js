const Post = require("../models/Post");
const User = require("../models/User");
const multer = require("multer");
const dotenv = require("dotenv");

const {
  uploadPostImagesToS3,
  getPostImageSignedUrlS3,
} = require("../modules/aws_s3");
const { transliterate } = require("../modules/transliteration");
const AppError = require("../modules/errorHandling/AppError");
const DateConverter = require("../modules/dateConverter");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const dateConverter = new DateConverter();

class PostsController {
  async createPost(req, res) {
    let searchAddress = await transliterate(req.body.location.address);
    let addressInfo = searchAddress.split(", ");
    let searchStreet = "";
    let searchCity = "";
    if (addressInfo.length > 2) {
      // if we have data about both street and city, save them both
      searchStreet = addressInfo[0];
      let nextIndex = 1;
      // sometimes it happens that second value in array is also the street info, because sometimes autocomplete api gives such value
      // e.g. Ulofa Palmea 3a, Ulofa Palmea, Belgrade, Serbia
      // so instead of writing Ulofa Palmea as searchCity (addressInfo[1]),
      // we want ro write Belgrade (addressInfo[2])
      while (nextIndex < addressInfo.length) {
        if (searchStreet.includes(addressInfo[nextIndex])) {
          nextIndex++;
        } else {
          searchCity = addressInfo[nextIndex];
          break;
        }
      }
    } else {
      // if we have data only about the city, save only the city/place
      searchCity = addressInfo[0];
    }
    console.log(searchStreet);
    console.log(searchCity);
    // return res.status(500).json({ message: "Internal Server Error" });

    let newPost = new Post({
      ...req.body,
      location: {
        address: req.body.location.address,
        searchAddress: searchAddress,
        searchStreet: searchStreet,
        searchCity: searchCity,
        latLng: req.body.location.latLng,
      },
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
  }

  async getPost(req, res) {
    //console.log(req.params.id);
    const post = (
      await Post.find({ _id: req.params.id, isArchived: false })
    )[0];
    //console.log(post);
    if (post == null) {
      throw new AppError("Post can't be found", 404);
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
  }

  async getUserPosts(req, res) {
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
    console.log(updatedPosts);
    res.status(200).json(updatedPosts);
  }

  async updatePost(req, res) {
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
      throw new AppError("You can only update your post!", 403);
    }
  }

  async deletePost(req, res) {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      //await Post.findByIdAndDelete(req.params.id);
      await Post.findByIdAndUpdate(post.id, {
        isArchived: true,
      });
      res
        .status(200)
        .json({ message: "Post has been removed from your account!" });
    } else {
      throw new AppError("You can only delete your post!", 403);
    }
  }

  async likePost(req, res) {
    const post = await Post.findById(req.params.id);
    let user = await User.findById(req.body.userId);
    if (!user.likedPosts.includes(post._id)) {
      await user.updateOne({ $push: { likedPosts: post._id.toString() } });
      user.likedPosts.push(post._id.toString());
      res.status(200).json(user.likedPosts);
    } else {
      await user.updateOne({ $pull: { likedPosts: post._id.toString() } });
      user.likedPosts = user.likedPosts.filter(
        (pid) => pid.toString() !== post._id.toString()
      );
      res.status(200).json(user.likedPosts);
    }
  }

  async getUserLikedPosts(req, res) {
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
  }

  async filterPosts(req, res) {
    // Create an array to store filter conditions
    const filters = [];
    const page = req.query.page || 1;
    const limit = req.query.limit || 12;

    // Step 1: Start Date Filters
    let startDate = "";
    if (
      req.query.startDate &&
      req.query.startDate !== "" &&
      req.query.startDate !== "undefined"
    ) {
      startDate = new Date(req.query.startDate);
    } else {
      startDate = new Date(1970, 0, 1, 0, 0, 0);
    }
    filters.push({
      $match: {
        from: { $gte: await dateConverter.convertDateToUTC(startDate) },
      },
    });

    // Step 2: End Date Filters
    let endDate = "";
    if (
      req.query.endDate &&
      req.query.endDate !== "" &&
      req.query.endDate !== "undefined"
    ) {
      endDate = new Date(req.query.endDate);
    } else {
      endDate = new Date(2100, 0, 1, 0, 0, 0);
    }
    filters.push({
      $match: {
        to: { $lte: await dateConverter.convertDateToUTC(endDate) },
      },
    });

    // Step 3: Start Price Filters
    let startPrice = 1;
    if (
      req.query.startPrice &&
      req.query.startPrice !== "" &&
      req.query.startPrice !== "undefined"
    ) {
      startPrice = req.query.startPrice;
    }
    console.log(startPrice);
    filters.push({
      $match: {
        price: {
          $gte: parseFloat(startPrice),
        },
      },
    });

    // Step 4: End Price Filters
    let endPrice = 100000;
    if (
      req.query.endPrice &&
      req.query.endPrice !== "" &&
      req.query.endPrice !== "undefined"
    ) {
      endPrice = req.query.endPrice;
    }
    console.log(endPrice);
    filters.push({
      $match: {
        price: {
          $lte: parseFloat(endPrice),
        },
      },
    });

    // Step 5: Location and Brand Filters
    let searchAddress = "";
    if (
      req.query.location &&
      req.query.location !== "" &&
      req.query.location !== "undefined"
    ) {
      searchAddress = await transliterate(req.query.location);
      //console.log(searchAddress);
    }
    filters.push({
      //
      $match: {
        $or: [
          {
            "location.searchStreet": { $regex: "^" + "" },
            "location.searchCity": { $regex: "^" + searchAddress },
          },
          {
            "location.searchStreet": { $regex: "^" + searchAddress },
            "location.searchCity": { $regex: "^" + "" },
          },
        ],
      },
    });

    // Step 6: return only non-archived posts
    filters.push({
      $match: {
        isArchived: {
          $eq: false,
        },
      },
    });

    // Step 7: Add brand for search
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
    //console.log(filters);
    if (filters.length > 0) {
      let aggregationPipeline = filters;

      const totalFilteredPosts = await Post.countDocuments({
        $and: aggregationPipeline.map((filter) => filter.$match),
      });

      console.log(totalFilteredPosts);
      let startTime = new Date();
      const posts =
        // await Post
        //   .aggregate(aggregationPipeline)
        //   .skip((page - 1) * limit)
        //   .limit(limit);
        await Post.find({
          $and: aggregationPipeline.map((filter) => filter.$match),
        })
          .skip((page - 1) * limit)
          .limit(limit);

      let endTime = new Date();
      console.log("Execution time: " + (endTime - startTime) + " milliseconds");
      //startTime = new Date();
      // console.log(
      //   // await Post.aggregate(aggregationPipeline)
      //   //   .skip((page - 1) * limit)
      //   //   .limit(limit)

      //   await Post.find({
      //     $and: aggregationPipeline.map((filter) => filter.$match),
      //   })
      //     .skip((page - 1) * limit)
      //     .limit(limit)
      //     .explain("executionStats")
      // );
      //endTime = new Date();
      //console.log("Execution time: " + (endTime - startTime) + " milliseconds");
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
    }
  }
}

module.exports = PostsController;
