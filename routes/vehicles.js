const router = require("express").Router();
const multer = require("multer");

const { verifyToken } = require("../middleware/auth");
const { tryCatch } = require("../modules/errorHandling/tryCatch");
const { inject } = require("dioma");
const VehicleService = require("../services/vehicles");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

function createVehicleRoutes(vehicleService = inject(VehicleService)) {
  //create a vehicle
  router.post(
    "/",
    upload.array("images[]", 10),
    verifyToken,
    tryCatch(async (req, res) => {
      await vehicleService.createVehicleFromRoute(req, res);
    })
  );

  //update a vehicle
  router.put(
    "/:id",
    upload.array("images[]", 10),
    verifyToken,
    tryCatch(async (req, res) => {
      await vehicleService.updateVehicleFromRoute(req, res);
    })
  );

  //delete a vehicle
  router.delete(
    "/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await vehicleService.deleteVehicleFromRoute(req, res);
    })
  );

  //get a vehicle
  router.get(
    "/:id",
    tryCatch(async (req, res) => {
      await vehicleService.getVehicleFromRoute(req, res);
    })
  );

  //get all user vehicles
  router.get(
    "/profile/:id",
    verifyToken,
    tryCatch(async (req, res) => {
      await vehicleService.getAllUserVehiclesWithImagesFromRoute(req, res);
    })
  );

  //get user vehicles
  router.get(
    "/user/:id",
    tryCatch(async (req, res) => {
      await vehicleService.getAllUserVehiclesWithoutImagesFromRoute(req, res);
    })
  );

  return router;
}
module.exports = { createVehicleRoutes };
