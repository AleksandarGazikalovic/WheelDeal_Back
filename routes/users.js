const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

function createUserRoutes(userService) {
  //update user
  router.put(
    "/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await userService.updateUserFromRoute(req, res);
    })
  );

  //delete user
  router.delete(
    "/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await userService.deleteUserFromRoute(req, res);
    })
  );

  router.get(
    "/",
    verifyToken,
    tryCatch(async (req, res) => {
      await userService.getUserFromRoute(req, res);
    })
  );

  //get a user
  router.get(
    "/:id",
    tryCatch(async (req, res) => {
      await userService.getUserByIdFromRoute(req, res);
    })
  );

  //upload profile picture
  router.post(
    "/:id/upload",
    upload.single("profileImage"),
    verifyToken,
    tryCatch(async (req, res) => {
      await userService.uploadProfileImageFromRoute(req, res);
    })
  );

  return router;
}

module.exports = { createUserRoutes };
