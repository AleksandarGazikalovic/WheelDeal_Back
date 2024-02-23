const sharp = require("sharp");

// determine a format in which pictures will be saved
const pictureFormat = "image/webp";

// convert image to selected size, format and quality
async function convertPicture(picture) {
  const convertedPicture = await sharp(picture)
    .resize(1440, 1080, { fit: "contain" })
    .webp({
      quality: 60,
    })
    .toBuffer();

  return convertedPicture;
}

async function compressProfileImage(image) {
  const compressedImageBuffer = await sharp(image)
    .resize({ width: 200, height: 200 }) // Adjust the dimensions as needed
    .toBuffer();

  return compressedImageBuffer;
}

module.exports = { pictureFormat, convertPicture, compressProfileImage };
