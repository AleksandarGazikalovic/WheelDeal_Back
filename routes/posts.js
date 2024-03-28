const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const PostsController = require("../controllers/posts");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const postsController = new PostsController();

//create a post
router.post(
  "/",
  upload.array("images[]", 10),
  verifyToken,
  tryCatch(async (req, res) => {
    await postsController.createPost(req, res);
  })
);

//update a post
router.put(
  "/:id",
  upload.array("images[]", 10),
  verifyToken,
  tryCatch(async (req, res) => {
    await postsController.updatePost(req, res);
  })
);

//delete a post
router.delete(
  "/:id",
  tryCatch(async (req, res) => {
    await postsController.deletePost(req, res);
  })
);

//like a post
router.put(
  "/:id/like",
  verifyToken,
  tryCatch(async (req, res) => {
    await postsController.likePost(req, res);
  })
);

//get a post
router.get(
  "/:id",
  tryCatch(async (req, res) => {
    await postsController.getPost(req, res);
  })
);

//get all user posts
router.get(
  "/profile/:id",
  tryCatch(async (req, res) => {
    await postsController.getUserPosts(req, res);
  })
);

//get all liked posts
router.get(
  "/liked/:id",
  tryCatch(async (req, res) => {
    await postsController.getUserLikedPosts(req, res);
  })
);

//filter posts by date and price
router.get(
  "/filter/all",
  tryCatch(async (req, res) => {
    await postsController.filterPosts(req, res);
  })
);

module.exports = router;
