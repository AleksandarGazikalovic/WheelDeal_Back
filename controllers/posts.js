const dotenv = require("dotenv");
const PostService = require("../services/posts");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const postService = new PostService();

class PostsController {
  //
  async createPost(req, res) {
    let createdPost = await postService.createPost(req);
    res.status(200).json(createdPost);
  }

  //
  async getPost(req, res) {
    const post = await postService.getPost({
      _id: req.params.id,
      isArchived: false,
    });

    post.images = await postService.getPostPictures(post);
    res.status(200).json(post);
  }

  //
  async getUserPosts(req, res) {
    const posts = await postService.getPosts({
      userId: req.params.id,
      isArchived: false,
    });

    const updatedPosts = await postService.getAllPostsWithPictures(posts);
    res.status(200).json(updatedPosts);
  }

  //
  async updatePost(req, res) {
    const updatedPost = await postService.updatePost(req);
    updatedPost.images = await postService.getPostPictures(updatedPost);

    res.status(200).json(updatedPost);
  }

  //
  async deletePost(req, res) {
    await postService.deletePost(req.params.id, req.body.userId);
    return res
      .status(200)
      .json({ message: "Post has been removed from your account!" });
  }

  //
  async likePost(req, res) {
    const user = await postService.likeDislikePost(
      req.params.id,
      req.body.userId
    );
    res.status(200).json(user.likedPosts);
  }

  //
  async getUserLikedPosts(req, res) {
    // Filter out deleted/archived posts from likedPosts
    const user = await postService.syncUserLikedPosts(req.params.id);

    // fetch remaining valid posts liked by user
    const posts = await postService.getUserLikedPosts(user.likedPosts);
    const postsWithPictures = await postService.getAllPostsWithPictures(posts);

    res.status(200).json(postsWithPictures);
  }

  //
  async filterPosts(req, res) {
    // Create an initial filter object
    let filter = await postService.initializeFilter(req);

    // Step 1: Start Date Filters
    filter = await postService.updateFilterByStartDate(
      filter,
      req.query.startDate
    );

    // Step 2: End Date Filters
    filter = await postService.updateFilterByEndDate(filter, req.query.endDate);

    // Step 3: Start Price Filters
    filter = await postService.updateFilterByStartPrice(
      filter,
      req.query.startPrice
    );

    // Step 4: End Price Filters
    filter = await postService.updateFilterByEndPrice(
      filter,
      req.body.endPrice
    );

    // Step 5: Location Filters
    filter = await postService.updateFilterByLocation(
      filter,
      req.query.location
    );

    // Step 6: return only non-archived posts
    filter = await postService.updateFilterByArchived(filter);

    // Step 7: Add brand for search
    filter = await postService.updateFilterByBrand(filter, req.body.brand);

    // apply the filter on posts
    const [posts, hasMore] = await postService.applyFilter(filter);
    const updatedPosts = await postService.getAllPostsWithPictures(posts);

    res.status(200).json({ posts: updatedPosts, hasMore });
  }
}

module.exports = PostsController;
