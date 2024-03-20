const sharp = require("sharp");

// determine a format in which pictures will be saved
const pictureFormat = "image/webp";

// convert image to selected size, format and quality
async function convertVehiclePicture(picture) {
  const convertedPicture = await sharp(picture)
    .resize(1440, 1080, { fit: "contain" })
    .webp({
      quality: 60,
    })
    .toBuffer();

  return convertedPicture;
}

async function convertProfilePicture(picture) {
  const compressedImageBuffer = await sharp(picture)
    .resize({
      fit: "contain",
      width: 250,
    })
    .webp({
      quality: 60,
    })
    .toBuffer();

  return compressedImageBuffer;
}

module.exports = {
  pictureFormat,
  convertVehiclePicture,
  convertProfilePicture,
};
