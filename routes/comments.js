const router = require("express").Router();

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const CommentsController = require("../controllers/comments");

const commentsController = new CommentsController();

// Create a comment
router.post(
  "/",
  verifyToken,
  tryCatch(async (req, res) => {
    await commentsController.createComment(req, res);
  })
);

// Fetch all comments for a post related to a user
router.get(
  "/:id",
  tryCatch(async (req, res) => {
    await commentsController.getComments(req, res);
  })
);

// Update a comment
router.put(
  "/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await commentsController.updateComment(req, res);
  })
);

// Delete a comment
router.delete(
  "/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await commentsController.deleteComment(req, res);
  })
);

module.exports = router;
