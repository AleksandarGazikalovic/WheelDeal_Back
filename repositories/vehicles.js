const Vehicle = require("../models/Vehicle");
const dependencyContainer = require("../modules/dependencyContainer");

class VehicleRepository {
  constructor() {
    dependencyContainer.register("vehicleRepository", this);
  }

  // find vehicle using any fields and their values
  async getVehicleByFields(searchData) {
    const foundVehicle = await Vehicle.findOne(searchData);
    return foundVehicle;
  }

  // find all vehicles by matching criteria
  async getAllVehiclesByFields(searchData) {
    const foundVehicles = await Vehicle.find({ ...searchData });
    return foundVehicles;
  }

  // create vehicle with given fields
  async createVehicle(vehicleData) {
    const newVehicle = new Vehicle(vehicleData);
    await newVehicle.save();
    return newVehicle;
  }

  // find vehicle by id and update that vehicle with given parameters
  async updateVehicle(vehicleId, vehicleData) {
    const updatedVehicle = await Vehicle.findByIdAndUpdate(
      vehicleId,
      vehicleData,
      { new: true } // This option returns the updated document
    );
    return updatedVehicle;
  }

  // find vehicle by id and delete that vehicle
  async deleteVehicle(vehicleId) {
    await Vehicle.findByIdAndDelete(vehicleId);
  }
}

module.exports = VehicleRepository;
