const router = require("express").Router();
const Vehicle = require("../models/Vehicle");
const multer = require("multer");
const dotenv = require("dotenv");
const {
  uploadVehicleImagesToS3,
  getVehicleImageSignedUrlS3,
} = require("../modules/aws_s3");
const { verifyToken } = require("../middleware/auth");
const VehicleRepository = require("../repositories/vehicles");
const AppError = require("../modules/errorHandling/AppError");

// dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

const vehicleRepository = new VehicleRepository();

class VehicleService {
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
    let newVehicle = await vehicleRepository.createVehicle({ ...req.body });

    const imageKeys = await uploadVehicleImagesToS3(
      req.files,
      req.body.userId,
      newVehicle.id
    );

    newVehicle = await vehicleRepository.updateVehicle(newVehicle.id, {
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
    const vehicle = await vehicleRepository.getVehicleByFields({
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

    const updatedVehicle = await vehicleRepository.updateVehicle(
      req.params.id,
      { images: imageKeys, ...req.body }
    );

    return updatedVehicle;
  }

  async getVehicle(vehicleData) {
    const vehicle = await vehicleRepository.getVehicleByFields(vehicleData);
    if (!vehicle) {
      throw new AppError("Vehicle not found.", 404);
    }
    return vehicle;
  }

  async getAllUserVehicles(vehicleData) {
    const vehicles = await vehicleRepository.getAllVehiclesByFields(
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
    const vehicle = await vehicleRepository.getVehicleByFields({
      _id: req.params.id,
    });
    if (!vehicle) {
      throw new AppError("Vehicle not found.", 404);
    }
    await this.checkCanChangeVehicle(vehicle, req.body.userId);

    await vehicleRepository.deleteVehicle(req.params.id);
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
}

module.exports = VehicleService;
