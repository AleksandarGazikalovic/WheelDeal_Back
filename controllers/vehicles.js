const VehicleService = require("../services/vehicles");

const vehicleService = new VehicleService();

class VehicleController {
  //
  async createVehicle(req, res) {
    const newVehicle = await vehicleService.createVehicle(req);
    res.status(200).json(newVehicle);
  }

  //
  async updateVehicle(req, res) {
    const updatedVehicle = await vehicleService.updateVehicle(req);
    updatedVehicle.images = await vehicleService.getVehiclePictures(
      updatedVehicle
    );
    res.status(200).json(updatedVehicle);
  }

  // TODO: add deleting vehicle images from aws
  async deleteVehicle(req, res) {
    await vehicleService.deleteVehicle(req);
    res.status(200).json({ message: "Vehicle has been deleted!" });
  }

  //
  async getVehicle(req, res) {
    const vehicle = await vehicleService.getVehicle({ _id: req.params.id });
    vehicle.images = await vehicleService.getVehiclePictures(vehicle);
    res.status(200).json(vehicle);
  }

  //
  async getAllUserVehiclesWithImages(req, res) {
    const vehicles = await vehicleService.getAllUserVehicles({
      userId: req.params.id,
    });
    const updatedVehicles = await vehicleService.getAllVehiclesWithPictures(
      vehicles
    );
    res.status(200).json(updatedVehicles);
  }

  //
  async getAllUserVehiclesWithoutImages(req, res) {
    const vehicles = await vehicleService.getAllUserVehicles({
      userId: req.params.id,
    });
    const vehicleResource = await vehicleService.getVehiclesWithoutImages(
      vehicles
    );
    res.status(200).json(vehicleResource);
  }
}

module.exports = VehicleController;
