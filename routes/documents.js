const router = require("express").Router();
const Document = require("../models/Document");
const dotenv = require("dotenv");
const { verifyToken } = require("../middleware/auth");
const multer = require("multer");
const {
  uploadDocumentToS3,
  getDocumentSignedUrlS3,
  deleteDocumentFromS3,
} = require("../modules/aws_s3");
const Vehicle = require("../models/Vehicle");

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

//add a document
router.post("/", upload.single("image"), verifyToken, async (req, res) => {
  try {
    console.log("req.body", req.body);
    //fetch existing document or create a new one if it doesn't exist
    let savedDocument = await Document.findOne({
      userId: req.body.userId,
      vehicleId: req.body.vehicleId,
      type: req.body.type,
    });

    if (!savedDocument) {
      savedDocument = await Document.create(req.body);
    } else {
      await deleteDocumentFromS3(
        req.body.userId,
        req.body.vehicleId,
        savedDocument.image,
        req.body.type
      );
    }

    const documentKey = await uploadDocumentToS3(
      req.file,
      req.body.userId,
      req.body.vehicleId,
      req.body.type
    );

    savedDocument = await Document.findByIdAndUpdate(
      savedDocument.id,
      {
        image: documentKey,
        ...req.body,
      },
      { new: true }
    );

    //add document id to array of documents in vehicle
    await Vehicle.findByIdAndUpdate(req.body.vehicleId, {
      $addToSet: { documents: savedDocument.id },
    });

    const url = await getDocumentSignedUrlS3(
      req.body.userId,
      req.body.vehicleId,
      savedDocument.image,
      req.body.type
    );
    savedDocument.image = url;

    res.status(200).json(savedDocument);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

//verify document
router.put("/:id/verify", verifyToken, async (req, res) => {
  try {
    const document = await Document.findByIdAndUpdate(
      req.params.id,
      {
        verified: true,
      },
      { new: true }
    );

    const documents = await Document.find({ vehicleId: document.vehicleId });
    if (documents.every((doc) => doc.verified === true)) {
      await Vehicle.findByIdAndUpdate(document.vehicleId, { isVerified: true });
    }

    res.status(200).json(document);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

//get all documents for a vehicle
router.get("/:vehicleId", verifyToken, async (req, res) => {
  try {
    const documents = await Document.find({ vehicleId: req.params.vehicleId });

    for (let i = 0; i < documents.length; i++) {
      const url = await getDocumentSignedUrlS3(
        documents[i].userId,
        documents[i].vehicleId,
        documents[i].image,
        documents[i].type
      );
      documents[i].image = url;
    }

    res.status(200).json(documents);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

module.exports = router;
