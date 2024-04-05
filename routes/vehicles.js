const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const VehicleController = require("../controllers/vehicles");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const vehicleController = new VehicleController();

//create a vehicle
router.post(
  "/",
  upload.array("images[]", 10),
  verifyToken,
  tryCatch(async (req, res) => {
    await vehicleController.createVehicle(req, res);
  })
);

//update a vehicle
router.put(
  "/:id",
  upload.array("images[]", 10),
  verifyToken,
  tryCatch(async (req, res) => {
    await vehicleController.updateVehicle(req, res);
  })
);

//delete a vehicle
router.delete(
  "/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await vehicleController.deleteVehicle(req, res);
  })
);

//get a vehicle
router.get(
  "/:id",
  tryCatch(async (req, res) => {
    await vehicleController.getVehicle(req, res);
  })
);

//get all user vehicles
router.get(
  "/profile/:id",
  verifyToken,
  tryCatch(async (req, res) => {
    await vehicleController.getAllUserVehiclesWithImages(req, res);
  })
);

//get user vehicles
router.get(
  "/user/:id",
  tryCatch(async (req, res) => {
    await vehicleController.getAllUserVehiclesWithoutImages(req, res);
  })
);

module.exports = router;
