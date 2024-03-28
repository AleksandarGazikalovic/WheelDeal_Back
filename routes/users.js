const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const UsersController = require("../controllers/users");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const usersController = new UsersController();

//update user
router.put(
  "/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await usersController.updateUser(req, res);
  })
);

//delete user
router.delete(
  "/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await usersController.deleteUser(req, res);
  })
);

router.get(
  "/",
  verifyToken,
  tryCatch(async (req, res) => {
    await usersController.getUser(req, res);
  })
);

//get a user
router.get(
  "/:id",
  tryCatch(async (req, res) => {
    await usersController.getUserById(req, res);
  })
);

//upload profile picture
router.post(
  "/:id/upload",
  upload.single("profileImage"),
  verifyToken,
  tryCatch(async (req, res) => {
    await usersController.uploadProfileImage(req, res);
  })
);

module.exports = router;
