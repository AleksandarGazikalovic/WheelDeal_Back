const dotenv = require("dotenv");
const {
  uploadVehicleImagesToS3,
  getVehicleImageSignedUrlS3,
} = require("../modules/aws_s3");
const VehicleRepository = require("../repositories/vehicles");
const AppError = require("../modules/errorHandling/AppError");
const { inject, Scopes } = require("dioma");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

class VehicleService {
  constructor(vehicleRepository = inject(VehicleRepository)) {
    this.vehicleRepository = vehicleRepository;
  }
  static scope = Scopes.Singleton();

  async getVehiclePictures(vehicle) {
    // console.log(vehicle);
    // console.log(vehicle.images);
    const updatedImages = [];
    for (let i = 0; i < vehicle.images.length; i++) {
      const url = await getVehicleImageSignedUrlS3(
        vehicle.images[i],
        vehicle.userId,
        vehicle.id
      );
      updatedImages.push(url);
    }
    return updatedImages;
  }

  async getAllVehiclesWithPictures(vehicles) {
    const imagePromises = vehicles.map(async (vehicle) => {
      vehicle.images = await this.getVehiclePictures(vehicle);
      return vehicle;
    });
    const updatedVehicles = await Promise.all(imagePromises);
    return updatedVehicles;
  }

  async createVehicle(req) {
    let newVehicle = await this.vehicleRepository.createVehicle({
      ...req.body,
    });

    const imageKeys = await uploadVehicleImagesToS3(
      req.files,
      req.body.userId,
      newVehicle.id
    );

    newVehicle = await this.vehicleRepository.updateVehicle(newVehicle.id, {
      images: imageKeys,
      ...req.body,
    });

    newVehicle.images = await this.getVehiclePictures(newVehicle);
    return newVehicle;
  }

  async checkCanChangeVehicle(vehicle, userId) {
    if (vehicle.userId.toString() === userId) {
      return true;
    } else {
      throw new AppError("You can only make changes to your vehicle!", 401);
    }
  }

  async updateVehicle(req) {
    const vehicle = await this.vehicleRepository.getVehicleByFields({
      _id: req.params.id,
    });
    if (!vehicle) {
      throw new AppError("Vehicle not found.", 404);
    }
    await this.checkCanChangeVehicle(vehicle, req.body.userId);

    let imageKeys = [];
    if (req.files && req.files.length > 0) {
      imageKeys = await uploadVehicleImagesToS3(
        req.files,
        req.body.userId,
        req.params.id
      );
    } else {
      imageKeys = vehicle.images;
    }

    const updatedVehicle = await this.vehicleRepository.updateVehicle(
      req.params.id,
      { images: imageKeys, ...req.body }
    );

    return updatedVehicle;
  }

  async getVehicle(vehicleData) {
    const vehicle = await this.vehicleRepository.getVehicleByFields(
      vehicleData
    );
    if (!vehicle) {
      throw new AppError("Vehicle not found.", 404);
    }
    return vehicle;
  }

  async getAllUserVehicles(vehicleData) {
    const vehicles = await this.vehicleRepository.getAllVehiclesByFields(
      vehicleData
    );
    if (!vehicles) {
      throw new AppError("Vehicles not found.", 404);
    }
    return vehicles;
  }

  async getAllVehiclesFromPosts(posts) {
    const vehicles = await Promise.all(
      posts.map((post) => {
        return this.getVehicle({ _id: post.vehicleId });
      })
    );
    return vehicles;
  }

  async deleteVehicle(req) {
    const vehicle = await this.vehicleRepository.getVehicleByFields({
      _id: req.params.id,
    });
    if (!vehicle) {
      throw new AppError("Vehicle not found.", 404);
    }
    await this.checkCanChangeVehicle(vehicle, req.body.userId);

    await this.vehicleRepository.deleteVehicle(req.params.id);
    // TODO: delete vehicle images from s3 bucket
  }

  async getVehiclesWithoutImages(vehicles) {
    return vehicles.map((vehicle) => {
      return {
        vehicleId: vehicle.id,
        brand: vehicle.brand,
        carModel: vehicle.carModel,
        year: vehicle.year,
      };
    });
  }

  //
  async createVehicleFromRoute(req, res) {
    const newVehicle = await this.createVehicle(req);
    res.status(200).json(newVehicle);
  }

  //
  async updateVehicleFromRoute(req, res) {
    const updatedVehicle = await this.updateVehicle(req);
    updatedVehicle.images = await this.getVehiclePictures(updatedVehicle);
    res.status(200).json(updatedVehicle);
  }

  // TODO: add deleting vehicle images from aws
  async deleteVehicleFromRoute(req, res) {
    await this.deleteVehicle(req);
    res.status(200).json({ message: "Vehicle has been deleted!" });
  }

  //
  async getVehicleFromRoute(req, res) {
    const vehicle = await this.getVehicle({ _id: req.params.id });
    vehicle.images = await this.getVehiclePictures(vehicle);
    res.status(200).json(vehicle);
  }

  //
  async getAllUserVehiclesWithImagesFromRoute(req, res) {
    const vehicles = await this.getAllUserVehicles({
      userId: req.params.id,
    });
    const updatedVehicles = await this.getAllVehiclesWithPictures(vehicles);
    res.status(200).json(updatedVehicles);
  }

  //
  async getAllUserVehiclesWithoutImagesFromRoute(req, res) {
    const vehicles = await this.getAllUserVehicles({
      userId: req.params.id,
    });
    const vehicleResource = await this.getVehiclesWithoutImages(vehicles);
    res.status(200).json(vehicleResource);
  }
}

module.exports = VehicleService;
