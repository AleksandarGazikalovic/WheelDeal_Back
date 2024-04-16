const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const { inject } = require("dioma");
const PostService = require("../services/posts");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

function createPostRoutes(postService = inject(PostService)) {
  //create a post
  router.post(
    "/",
    upload.array("images[]", 10),
    verifyToken,
    tryCatch(async (req, res) => {
      await postService.createPostFromRoute(req, res);
    })
  );

  //update a post
  router.put(
    "/:id",
    upload.array("images[]", 10),
    verifyToken,
    tryCatch(async (req, res) => {
      await postService.updatePostFromRoute(req, res);
    })
  );

  //delete a post
  router.delete(
    "/:id",
    tryCatch(async (req, res) => {
      await postService.deletePostFromRoute(req, res);
    })
  );

  //like a post
  router.put(
    "/:id/like",
    verifyToken,
    tryCatch(async (req, res) => {
      await postService.likePostFromRoute(req, res);
    })
  );

  //get a post
  router.get(
    "/:id",
    tryCatch(async (req, res) => {
      await postService.getPostFromRoute(req, res);
    })
  );

  //get all user posts
  router.get(
    "/profile/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await postService.getUserPostsFromRoute(req, res);
    })
  );

  //get all liked posts
  router.get(
    "/liked/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await postService.getUserLikedPostsFromRoute(req, res);
    })
  );

  //filter posts by date and price
  router.get(
    "/filter/all",
    tryCatch(async (req, res) => {
      await postService.filterPostsFromRoute(req, res);
    })
  );

  return router;
}
module.exports = { createPostRoutes };
