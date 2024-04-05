const Vehicle = require("../models/Vehicle");

class VehicleRepository {
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
    // updating must be done this way because if you use any update variant it will ommit "undefined" values
    const vehicle = await Vehicle.findOne({ _id: vehicleId });
    for (let field in vehicleData) {
      vehicle[field] = vehicleData[field];
    }
    const updatedVehicle = await vehicle.save();
    return updatedVehicle;
  }

  // find vehicle by id and delete that vehicle
  async deleteVehicle(vehicleId) {
    await Vehicle.findByIdAndDelete(vehicleId);
  }
}

module.exports = VehicleRepository;
