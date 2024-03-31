const router = require("express").Router();
const Document = require("../models/Document");
const dotenv = require("dotenv");
const { verifyToken } = require("../middleware/auth");
const multer = require("multer");
const {
  uploadDocumentToS3,
  getDocumentSignedUrlS3,
} = require("../modules/aws_s3");

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
router.post("/", upload.single("idCard"), verifyToken, async (req, res) => {
  try {
    console.log(req.body);
    let newDocument = new Document({
      ...req.body,
    });
    let savedDocument = await newDocument.save();

    const documentKey = await uploadDocumentToS3(
      req.file,
      req.body.userId,
      req.body.type,
      req.body.vehicleId,
      savedDocument.id
    );

    savedDocument = await Document.findByIdAndUpdate(
      savedDocument.id,
      {
        document: documentKey,
        ...req.body,
      },
      { new: true }
    );

    const url = await getDocumentSignedUrlS3(
      savedDocument.document,
      req.body.userId,
      savedDocument.id
    );
    savedDocument.document = url;

    res.status(200).json(savedDocument);
  } catch (err) {
    console.log(err);
    return res.status(500).json(err);
  }
});

module.exports = router;
