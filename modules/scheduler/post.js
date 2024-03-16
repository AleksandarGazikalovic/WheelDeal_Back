const cron = require("node-cron");
const Post = require("../../models/Post");
const { deletePostImagesFromS3 } = require("../aws_s3");

// description: delete post from Mongo and post images from S3 bucket for archived posts
// target group: posts that have been archived for 4 weeks
// argument "5 0 * * *": triggers every day at 00:05
// TESTING: for testing use argument "*/10 * * * * *" -> triggers every 10 seconds
cron.schedule("5 0 * * *", async () => {
  const archivedPosts = await Post.find({ isArchived: true });
  const currentTime = new Date();
  console.log("Removing archived posts at " + currentTime);

  // for each archived post, remove them from database and remove its pictures from S3 bucket
  for (let i = 0; i < archivedPosts.length; i++) {
    const postArchivedAt = new Date(archivedPosts[i].updatedAt);
    const timeDifference = currentTime - postArchivedAt; // time difference in milliseconds
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
});
