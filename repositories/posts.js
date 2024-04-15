const { Scopes } = require("dioma");
const Post = require("../models/Post");

class PostRepository {
  // Single instance of the class for the entire application
  static scope = Scopes.Singleton();

  // create post with given fields
  async createPost(postData) {
    const newPost = new Post(postData);
    await newPost.save();
    return newPost;
  }

  // find post using any fields and their values
  async getPostByFields(searchData) {
    const foundPost = await Post.findOne({ ...searchData, isArchived: false });
    return foundPost;
  }

  // find all posts by matching criteria
  async getAllPostsByFields(searchData) {
    const foundPosts = await Post.find({ ...searchData, isArchived: false });
    return foundPosts;
  }

  // find post by id and update that post with given parameters
  async updatePost(postId, postData) {
    // updating must be done this way because if you use any update variant it will ommit "undefined" values
    const post = await Post.findOne({ _id: postId, isArchived: false });
    for (let field in postData) {
      post[field] = postData[field];
    }
    const updatedPost = await post.save();
    return updatedPost;
  }

  // "delete" post by archiving it
  async deletePost(postId) {
    await Post.findByIdAndUpdate(postId, {
      isArchived: true,
    });
  }

  async performFilterSearch(filter) {
    // first determine if filter can return more posts than currently shown on front
    const totalFilteredPosts = await Post.countDocuments({
      $and: filter.filters.map((filter) => filter.$match),
    });

    const hasMore = filter.page * filter.limit < totalFilteredPosts;

    // then return all posts that will currently be shown on screen
    // (with flag that indicates if there are more posts than currently displayed)
    const posts = await Post.find({
      $and: filter.filters.map((filter) => filter.$match),
    })
      .skip((filter.page - 1) * filter.limit)
      .limit(filter.limit);

    return [posts, hasMore];
  }
}

module.exports = PostRepository;
