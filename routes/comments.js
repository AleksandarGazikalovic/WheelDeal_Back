const router = require("express").Router();

const { inject } = require("dioma");
const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const CommentService = require("../services/comments");

function createCommentRoutes(commentService = inject(CommentService)) {
  // Create a comment
  router.post(
    "/",
    verifyToken,
    tryCatch(async (req, res) => {
      await commentService.createCommentFromRoute(req, res);
    })
  );

  // Fetch all comments for a post related to a user
  router.get(
    "/:id",
    tryCatch(async (req, res) => {
      await commentService.getCommentsFromRoute(req, res);
    })
  );

  // Update a comment
  router.put(
    "/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await commentService.updateCommentFromRoute(req, res);
    })
  );

  // Delete a comment
  router.delete(
    "/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await commentService.deleteCommentFromRoute(req, res);
    })
  );

  return router;
}

module.exports = { createCommentRoutes };
