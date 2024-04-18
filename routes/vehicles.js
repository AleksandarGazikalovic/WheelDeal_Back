const router = require("express").Router();
const Vehicle = require("../models/Vehicle");
const multer = require("multer");
const dotenv = require("dotenv");
const {
  uploadVehicleImagesToS3,
  getVehicleImageSignedUrlS3,
} = require("../modules/aws_s3");
const { verifyToken } = require("../middleware/auth");

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

//create a vehicle
router.post(
  "/",
  upload.array("images[]", 10),
  verifyToken,
  async (req, res) => {
    try {
      let newVehicle = new Vehicle({
        ...req.body,
      });
      let savedVehicle = await newVehicle.save();

      const imageKeys = await uploadVehicleImagesToS3(
        req.files,
        req.body.userId,
        savedVehicle.id
      );

      savedVehicle = await Vehicle.findByIdAndUpdate(
        savedVehicle.id,
        {
          images: imageKeys,
          ...req.body,
        },
        { new: true }
      );

      const updatedImages = [];
      for (let i = 0; i < savedVehicle.images.length; i++) {
        const url = await getVehicleImageSignedUrlS3(
          savedVehicle.images[i],
          req.body.userId,
          savedVehicle.id
        );
        updatedImages.push(url);
      }
      savedVehicle.images = updatedImages;

      res.status(200).json(savedVehicle);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

//update a vehicle
router.put(
  "/:id",
  upload.array("images[]", 10),
  verifyToken,
  async (req, res) => {
    try {
      console.log(req.body);
      const vehicle = await Vehicle.findById(req.params.id);
      if (vehicle.userId === req.body.userId) {
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
        const updatedVehicle = await Vehicle.findByIdAndUpdate(
          req.params.id,
          {
            images: imageKeys,
            ...req.body,
          },
          { new: true }
        );

        const updatedImages = [];

        for (let i = 0; i < updatedVehicle.images.length; i++) {
          const url = await getVehicleImageSignedUrlS3(
            updatedVehicle.images[i],
            req.body.userId,
            updatedVehicle.id
          );
          updatedImages.push(url);
        }

        updatedVehicle.images = updatedImages;

        res.status(200).json(updatedVehicle);
      } else {
        res.status(401).json({ message: "You can only update your vehicle!" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

//delete a vehicle
router.delete("/:id", async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (vehicle.userId === req.body.userId) {
      try {
        await Vehicle.findByIdAndDelete(req.params.id);
        // TODO: delete vehicle images from s3 bucket
        res.status(200).json({ message: "Vehicle has been deleted!" });
      } catch (err) {
        res.status(500).json(err);
      }
    } else {
      res.status(401).json({ message: "You can only delete your vehicle!" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get a vehicle
router.get("/:id", async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    const updatedImages = [];
    for (let i = 0; i < vehicle.images.length; i++) {
      const url = await getVehicleImageSignedUrlS3(
        vehicle.images[i],
        vehicle.userId,
        vehicle.id
      );
      updatedImages.push(url);
    }
    vehicle.images = updatedImages;
    res.status(200).json(vehicle);
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get all user vehicles
router.get("/profile/:id", async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      userId: req.params.id,
    });
    const imagePromises = vehicles.map(async (vehicle) => {
      const updatedImages = [];

      for (let i = 0; i < vehicle.images.length; i++) {
        const url = await getVehicleImageSignedUrlS3(
          vehicle.images[i],
          req.params.id,
          vehicle.id
        );
        updatedImages.push(url);
      }
      vehicle.images = updatedImages;
      return vehicle;
    });
    const updatedVehicles = await Promise.all(imagePromises);
    res.status(200).json(updatedVehicles);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//get user vehicles names
router.get("/user/:id", async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      userId: req.params.id,
      isVerified: true,
    });
    const vehicleResource = vehicles.map((vehicle) => {
      return {
        vehicleId: vehicle.id,
        brand: vehicle.brand,
        carModel: vehicle.carModel,
        year: vehicle.year,
      };
    });
    res.status(200).json(vehicleResource);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
