const dotenv = require("dotenv");

const {
  uploadPostImagesToS3,
  getPostImageSignedUrlS3,
} = require("../modules/aws_s3");
const { transliterate } = require("../modules/transliteration");
const AppError = require("../modules/errorHandling/AppError");
const DateConverter = require("../modules/dateConverter");
const UserService = require("./users");
const PostRepository = require("../repositories/posts");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const dateConverter = new DateConverter();
const postRepository = new PostRepository();
const userService = new UserService();

class PostService {
  async extractCityStreetFromAddress(address) {
    let searchAddress = await transliterate(address);
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

    return [searchAddress, searchStreet, searchCity];
  }

  async getPostPictures(post) {
    const updatedImages = [];
    for (let i = 0; i < post.images.length; i++) {
      const url = await getPostImageSignedUrlS3(
        post.images[i],
        post.userId,
        post.id
      );
      updatedImages.push(url);
    }
    return updatedImages;
  }

  async getAllPostsWithPictures(posts) {
    const imagePromises = posts.map(async (post) => {
      post.images = await this.getPostPictures(post);
      return post;
    });
    const updatedPosts = await Promise.all(imagePromises);
    return updatedPosts;
  }

  async getPost(postData) {
    const post = await postRepository.getPostByFields(postData);
    if (!post) {
      throw new AppError("Post not found", 404);
    }
    return post;
  }

  async getPosts(postData) {
    const posts = await postRepository.getAllPostsByFields(postData);
    return posts;
  }

  async checkPostExistsById(postId) {
    const post = await postRepository.getPostByFields({ _id: postId });
    if (!post) {
      throw new AppError("Post not found.", 404);
    }
    return post;
  }

  async createPost(req) {
    let [searchAddress, searchStreet, searchCity] =
      await this.extractCityStreetFromAddress(req.body.location.address);

    let savedPost = await postRepository.createPost({
      ...req.body,
      location: {
        address: req.body.location.address,
        searchAddress: searchAddress,
        searchStreet: searchStreet,
        searchCity: searchCity,
        latLng: req.body.location.latLng,
      },
    });

    const imageKeys = await uploadPostImagesToS3(
      req.files,
      req.body.userId,
      savedPost.id
    );

    // link aws uploaded pics to post
    savedPost = await postRepository.updatePost(savedPost.id, {
      images: imageKeys,
    });

    savedPost.images = await this.getPostPictures(savedPost);
    return savedPost;
  }

  async updatePost(req) {
    const post = await postRepository.getPostByFields({ _id: req.params.id });
    if (post.userId === req.body.userId) {
      let imageKeys = [];
      // update pictures if user uploaded new images ("stomp over" the old ones)
      if (req.files && req.files.length > 0) {
        imageKeys = await uploadPostImagesToS3(
          req.files,
          req.body.userId,
          req.params.id
        );
      } else {
        imageKeys = post.images;
      }

      const updatedPost = await postRepository.updatePost(req.params.id, {
        images: imageKeys,
        ...req.body,
      });

      return updatedPost;
    } else {
      throw new AppError("You can only update your post!", 403);
    }
  }

  async deletePost(postId, userId) {
    const post = await postRepository.getPostByFields({ _id: postId });
    if (post.userId === userId) {
      await postRepository.deletePost(post.id);
    } else {
      throw new AppError("You can only delete your post!", 403);
    }
  }

  async likeDislikePost(postId, userId) {
    const post = await postRepository.getPostByFields({ _id: postId });
    const user = await userService.getUser({ _id: userId });
    if (user && post) {
      // if post wasnt previously liked, push it to liked list
      if (!user.likedPosts.includes(post._id)) {
        user.likedPosts = await userService.updateUserLikedPosts(
          userId,
          postId,
          true
        );
      } else {
        // if post was previously liked, remove it from liked list
        user.likedPosts = await userService.updateUserLikedPosts(
          userId,
          postId,
          false
        );
      }
      return user;
    } else {
      throw new AppError(
        "Couldn't like/dislike post (id=" +
          postId +
          ") by user (id=" +
          userId +
          ")",
        400
      );
    }
  }

  async syncUserLikedPosts(userId) {
    const user = await userService.getUser({ _id: userId });

    // Filter out deleted posts from likedPosts
    const validLikedPosts = await Promise.all(
      user.likedPosts.map(async (postId) => {
        const post = await this.getPost({ _id: postId });
        return post !== null && post.isArchived === false ? postId : null;
      })
    );

    // Remove null entries (deleted posts) from the array
    const nonNullValidLikedPosts = validLikedPosts.filter(
      (postId) => postId !== null
    );

    // Save the updated likedPosts array
    const userWithValidLikedPosts = await userService.updateUser(userId, {
      likedPosts: nonNullValidLikedPosts,
    });

    return userWithValidLikedPosts;
  }

  async getUserLikedPosts(likedPostsIds) {
    const userLikedPosts = await Promise.all(
      likedPostsIds.map((postId) => {
        return this.getPost({ _id: postId });
      })
    );

    return userLikedPosts;
  }

  // filter part begin
  async initializeFilter(req) {
    const initFilter = {
      filters: [],
      page: req.query.page || 1,
      limit: req.query.limit || 12,
    };
    return initFilter;
  }

  async updateFilterByStartDate(filter, startDate) {
    let currStartDate = "";
    if (startDate && startDate !== "" && startDate !== undefined) {
      currStartDate = new Date(startDate);
    } else {
      currStartDate = new Date(1970, 0, 1, 0, 0, 0);
    }
    filter.filters.push({
      $match: {
        from: { $gte: await dateConverter.convertDateToUTC(currStartDate) },
      },
    });
    return filter;
  }

  async updateFilterByEndDate(filter, endDate) {
    let currEndDate = "";
    if (endDate && endDate !== "" && endDate !== undefined) {
      currEndDate = new Date(endDate);
    } else {
      currEndDate = new Date(2100, 0, 1, 0, 0, 0);
    }
    filter.filters.push({
      $match: {
        to: { $lte: await dateConverter.convertDateToUTC(currEndDate) },
      },
    });
    return filter;
  }

  async updateFilterByStartPrice(filter, startPrice) {
    let currStartPrice = 1;
    if (startPrice && startPrice !== "" && startPrice !== undefined) {
      currStartPrice = startPrice;
    }
    // console.log(currStartPrice);
    filter.filters.push({
      $match: {
        price: {
          $gte: parseFloat(currStartPrice),
        },
      },
    });
    return filter;
  }

  async updateFilterByEndPrice(filter, endPrice) {
    let currEndPrice = 100000;
    if (endPrice && endPrice !== "" && endPrice !== undefined) {
      currEndPrice = endPrice;
    }
    // console.log(currEndPrice);
    filter.filters.push({
      $match: {
        price: {
          $lte: parseFloat(currEndPrice),
        },
      },
    });
    return filter;
  }

  async updateFilterByLocation(filter, location) {
    let searchAddress = "";
    if (location && location !== "" && location !== undefined) {
      searchAddress = await transliterate(location);
      // console.log(searchAddress);
    }
    filter.filters.push({
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
    return filter;
  }

  async updateFilterByArchived(filter) {
    filter.filters.push({
      $match: {
        isArchived: {
          $eq: false,
        },
      },
    });
    return filter;
  }

  async updateFilterByBrand(filter, brand) {
    if (brand && brand !== "" && brand !== undefined) {
      filter.filters.push({
        $match: {
          brand: { $regex: req.query.brand, $options: "i" },
        },
      });
    }
    return filter;
  }

  async applyFilter(filter) {
    // let startTime = new Date();
    const [posts, hasMore] = await postRepository.performFilterSearch(filter);

    // let endTime = new Date();
    // console.log("Execution time: " + (endTime - startTime) + " milliseconds");

    return [posts, hasMore];
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
  }
  // filter part end
}

module.exports = PostService;
