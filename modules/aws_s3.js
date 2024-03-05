const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const dotenv = require("dotenv");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const {
  convertPostPicture,
  convertProfilePicture,
  pictureFormat,
} = require("./pictures");

if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
} else {
  dotenv.config({ path: `.env.development` });
}

const rootBucketFolder = process.env.ROOT_BUCKET_FOLDER;

const randomImageName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const s3 = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function getProfileImageSignedUrlS3(profileImage, userId) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: rootBucketFolder + "/" + "User_" + userId + "/" + profileImage,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });

  return signedUrl;
}

async function getPostImageSignedUrlS3(profileImage, userId, postId) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key:
      rootBucketFolder +
      "/" +
      "User_" +
      userId +
      "/" +
      "Post_" +
      postId +
      "/" +
      profileImage,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });

  return signedUrl;
}

// image uploading with compression
const uploadPostImagesToS3 = async (files, userId, postId) => {
  const imageKeys = [];

  for (const file of files) {
    const imageName = randomImageName();
    const fileContent = file.buffer;
    // convert image to webp and compress it
    const convertedPicture = await convertPostPicture(fileContent);

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Body: convertedPicture,
      Key:
        rootBucketFolder +
        "/" +
        "User_" +
        userId +
        "/" +
        "Post_" +
        postId +
        "/" +
        imageName,
      ContentType: pictureFormat,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3.send(command);

    imageKeys.push(imageName);
  }

  return imageKeys;
};

async function uploadProfileImageToS3(file, fileName, userId) {
  const fileType = pictureFormat;
  const fileContent = file.buffer;

  // Resize and compress the image
  const resizedImageBuffer = await convertProfilePicture(fileContent);

  // Upload the new profile image to your storage (e.g., S3)
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: rootBucketFolder + "/" + "User_" + userId + "/" + fileName,
    Body: resizedImageBuffer,
    ContentType: fileType,
  });

  s3.send(command);
}

async function deleteProfileImageFromS3(image, userId) {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: rootBucketFolder + "/" + "User_" + userId + "/" + image,
  });
  s3.send(deleteCommand);
}

async function deletePostImagesFromS3(userId, postId) {
  const command = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME,
    Delimiter: "/",
    Prefix:
      rootBucketFolder + "/" + "User_" + userId + "/" + "Post_" + postId + "/",
    MaxKeys: 1000,
  });

  try {
    let isTruncated = true;
    let contents = [];

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } = await s3.send(
        command
      );
      Contents.map((c) => contents.push(c.Key));
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
    }

    for (let image of contents) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: image,
      });
      s3.send(deleteCommand);
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  getProfileImageSignedUrlS3,
  getPostImageSignedUrlS3,
  uploadProfileImageToS3,
  uploadPostImagesToS3,
  deleteProfileImageFromS3,
  deletePostImagesFromS3,
};
