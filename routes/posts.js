const router = require("express").Router();
const Post = require("../models/Post");
const User = require("../models/User");
const dotenv = require("dotenv");

const {
  uploadVehicleImagesToS3: uploadVehicleImagesToS3,
  getVehicleImageSignedUrlS3,
} = require("../modules/aws_s3");
const { verifyToken } = require("../middleware/auth");
const { transliterate } = require("../modules/transliteration");
const { default: mongoose } = require("mongoose");
const Vehicle = require("../models/Vehicle");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

//create a post
router.post("/", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.body.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    let searchAddress = await transliterate(req.body.location.address);
    let addressInfo = searchAddress.split(", ");
    let searchStreet = "";
    let searchCity = "";
    if (addressInfo.length > 2) {
      // if we have data about both street and city, save them both
      searchStreet = addressInfo[0];
      searchCity = addressInfo[1];
    } else {
      // if we have data only about the city, save only the city/place
      searchCity = addressInfo[0];
    }
    console.log(searchStreet);
    console.log(searchCity);
    // return res.status(500).json({ message: "Internal Server Error" });

    let newPost = new Post({
      ...req.body,
      userId: req.body.userId,
      vehicleId: req.body.vehicleId,
      location: {
        address: req.body.location.address,
        lat: req.body.location.lat,
        lng: req.body.location.lng,
        searchAddress: searchAddress,
        searchStreet: searchStreet,
        searchCity: searchCity,
      },
    });

    let savedPost = await newPost.save();

    let vehicle = await Vehicle.findById(req.body.vehicleId);
    const updatedImages = [];
    for (let i = 0; i < vehicle.images.length; i++) {
      const url = await getVehicleImageSignedUrlS3(
        vehicle.images[i],
        req.body.userId,
        vehicle.id
      );
      updatedImages.push(url);
    }

    vehicle.images = updatedImages;

    embeddedPost = {
      ...savedPost._doc,
      vehicle: vehicle,
    };

    res.status(200).json(embeddedPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//update a post
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (post.userId === req.body.userId) {
      const vehicle = await Vehicle.findById(post.vehicleId);

      const updatedPost = await Post.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
        },
        { new: true }
      );

      const updatedImages = [];

      for (let i = 0; i < vehicle.images.length; i++) {
        const url = await getVehicleImageSignedUrlS3(
          vehicle.images[i],
          req.body.userId,
          vehicle.id
        );
        updatedImages.push(url);
      }

      vehicle.images = updatedImages;

      const embeddedPost = {
        ...updatedPost._doc,
        vehicle: vehicle,
      };

      res.status(200).json(embeddedPost);
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

    const vehicle = await Vehicle.findById(post.vehicleId);

    const updatedImages = [];
    for (let i = 0; i < vehicle.images.length; i++) {
      const url = await getVehicleImageSignedUrlS3(
        vehicle.images[i],
        vehicle.userId,
        vehicle.id
      );
      updatedImages.push(url);
    }
    vehicle.images = updatedImages;

    const embeddedPost = {
      ...post._doc,
      vehicle: vehicle,
    };
    res.status(200).json(embeddedPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get all user posts
router.get("/profile/:id", async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.id, isArchived: false });

    const vehicles = await Promise.all(
      posts.map((post) => {
        return Vehicle.findById(post.vehicleId);
      })
    );
    console.log(vehicles);
    const imagePromises = vehicles.map(async (vehicle) => {
      const updatedImages = [];

      for (let i = 0; i < vehicle.images.length; i++) {
        const url = await getVehicleImageSignedUrlS3(
          vehicle.images[i],
          req.params.id,
          vehicle.id
        );
        updatedImages.push(url);
      }
      vehicle.images = updatedImages;
      return vehicle;
    });

    const updatedVehicles = await Promise.all(imagePromises);

    const embeddedPosts = posts.map((post, index) => {
      return {
        ...post._doc,
        vehicle: updatedVehicles[index],
      };
    });

    res.status(200).json(embeddedPosts);
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

    const vehicles = await Promise.all(
      posts.map((post) => {
        return Vehicle.findById(post.vehicleId);
      })
    );

    const imagePromises = vehicles.map(async (vehicle) => {
      const updatedImages = [];

      for (let i = 0; i < vehicle.images.length; i++) {
        const url = await getVehicleImageSignedUrlS3(
          vehicle.images[i],
          vehicle.userId,
          vehicle.id
        );
        updatedImages.push(url);
      }
      vehicle.images = updatedImages;
      return vehicle;
    });
    const updatedVehicles = await Promise.all(imagePromises);

    const embeddedPosts = posts.map((post, index) => {
      return {
        ...post._doc,
        vehicle: updatedVehicles[index],
      };
    });

    res.status(200).json(embeddedPosts);
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

    // Step 1: Start Date Filters
    if (
      req.query.startDate &&
      req.query.startDate !== "" &&
      req.query.startDate !== "undefined"
    ) {
      const startDate = req.query.startDate;
      // console.log(startDate);
      filters.push({
        $match: {
          from: { $gte: new Date(startDate) },
        },
      });
    }

    // Step 2: End Date Filters
    if (
      req.query.endDate &&
      req.query.endDate !== "" &&
      req.query.endDate !== "undefined"
    ) {
      const endDate = req.query.endDate;
      // console.log(endDate);
      filters.push({
        $match: {
          to: { $lte: new Date(endDate) },
        },
      });
    }

    // Step 3: Start Price Filters
    if (
      req.query.startPrice &&
      req.query.startPrice !== "" &&
      req.query.startPrice !== "undefined"
    ) {
      const startPrice = req.query.startPrice;
      filters.push({
        $match: {
          price: {
            $gte: parseFloat(startPrice),
          },
        },
      });
    }

    // Step 4: End Price Filters
    if (
      req.query.endPrice &&
      req.query.endPrice !== "" &&
      req.query.endPrice !== "undefined"
    ) {
      const endPrice = req.query.endPrice;
      filters.push({
        $match: {
          price: {
            $lte: parseFloat(endPrice),
          },
        },
      });
    }

    // Step 5: Location and Brand Filters
    let searchAddress = "";
    if (
      req.query.location &&
      req.query.location !== "" &&
      req.query.location !== "undefined"
    ) {
      searchAddress = await transliterate(req.query.location);
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
    // let brand = "";
    // if (
    //   req.query.brand &&
    //   req.query.brand !== "" &&
    //   req.query.brand !== "undefined"
    // ) {
    //   brand = req.query.brand;
    // }
    // filters.push({
    //   $match: {
    //     brand: { $regex: "^" + brand },
    //   },
    // });

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
      const vehicles = await Promise.all(
        posts.map((post) => {
          return Vehicle.findById(post.vehicleId);
        })
      );
      const imagePromises = vehicles.map(async (vehicle) => {
        const updatedImages = [];

        for (let i = 0; i < vehicle.images.length; i++) {
          const url = await getVehicleImageSignedUrlS3(
            vehicle.images[i],
            vehicle.userId,
            vehicle._id.toString()
          );
          updatedImages.push(url);
        }
        vehicle.images = updatedImages;
        return vehicle;
      });
      const updatedVehicles = await Promise.all(imagePromises);

      const hasMore = page * limit < totalFilteredPosts;

      const embeddedPosts = posts.map((post, index) => {
        return {
          ...post._doc,
          vehicle: updatedVehicles[index],
        };
      });

      res.status(200).json({ posts: embeddedPosts, hasMore });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
