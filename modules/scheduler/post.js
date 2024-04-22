const cron = require("node-cron");
const Post = require("../../models/Post");
const { deletePostImagesFromS3 } = require("../aws_s3");
const dependencyContainer = require("../../modules/dependencyContainer");

const dateConverter = dependencyContainer.getDependency("dateConverter");

// description: DELETE POST FROM MONGO AND POST IMAGES FROM S3 BUCKET FOR ARCHIVED POSTS
// target group: posts that have been archived for 4 weeks
// argument "10 23 * * *": triggers every day at 23:10 UTC time (00:10 in Serbia)
// TESTING: for testing use argument "*/10 * * * * *" -> triggers every 10 seconds
const deleteArchivedPostsJob = cron.schedule(
  "10 23 * * *",
  async () => {
    const archivedPosts = await Post.find({ isArchived: true });
    const currentDateTime = await dateConverter.convertDateToUTC(new Date());
    console.log("Removing archived posts at " + currentDateTime);

    // for each archived post, remove them from database and remove its pictures from S3 bucket
    for (let i = 0; i < archivedPosts.length; i++) {
      const postArchivedAt = new Date(archivedPosts[i].updatedAt);
      const timeDifference = currentDateTime - postArchivedAt; // time difference in milliseconds
      //const twoMinutesInMilliseconds = 1000 * 60 * 2; // for testing purposes
      const fourWeeksInMilliseconds = 1000 * 60 * 60 * 24 * 28; // 28 days in milliseconds

      // check if 4 weeks have passed since user registration
      if (timeDifference >= fourWeeksInMilliseconds) {
        // delete pictures from s3 bucket
        await deletePostImagesFromS3(
          archivedPosts[i].userId,
          archivedPosts[i]._id.toString()
        );

        // delete post from database
        await Post.findByIdAndDelete(archivedPosts[i].id);
        console.log(
          "Post " +
            archivedPosts[i].id +
            " successfuly removed due to being archived for over 4 weeks, images removed from S3 bucket"
        );
      }
    }
  },
  {
    timezone: "UTC", // Set the timezone to UTC
  }
);

// description: ARCHIVE POST WHOSE CAR RENTING PERIOD HAS PASSED
// target group: e.g. posts that have renting period Mar. 1 - Mar. 15 and today is Mar. 16
// argument "5 23 * * *": triggers every day at 23:05 UTC time (00:05 in Serbia)
// TESTING: for testing use argument "*/10 * * * * *" -> triggers every 10 seconds
const archiveExpiredPostsJob = cron.schedule(
  "5 23 * * *",
  async () => {
    try {
      const currentDateTime = await dateConverter.convertDateToUTC(new Date());
      console.log("Archiving posts at " + currentDateTime);

      const expiredPosts = await Post.find({
        isArchived: false,
        to: { $lt: currentDateTime },
      });

      for (let expiredPost of expiredPosts) {
        await Post.findByIdAndUpdate(expiredPost.id, {
          isArchived: true,
        });
      }

      console.log("Archived " + expiredPosts.length + " posts");
    } catch (err) {
      console.log("Error while trying to archive: " + err);
    }
  },
  {
    timezone: "UTC", // Set the timezone to UTC
  }
);

deleteArchivedPostsJob.start();
archiveExpiredPostsJob.start();
