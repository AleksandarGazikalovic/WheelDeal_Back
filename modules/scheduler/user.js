const cron = require("node-cron");
const User = require("../../models/User");

// description: delete users who haven't competed verification
// target group: user made an account but hasn't verified email address in 4 weeks
// argument "0 0 * * *": triggers every day at midnight
// TESTING: for testing use argument "*/10 * * * * *" -> triggers every 10 seconds
cron.schedule("0 0 * * *", async () => {
  const unverifiedUsers = await User.find({ isAccountVerified: false });
  const currentTime = new Date();
  console.log("Removing unverified accounts at " + currentTime);

  // for each unverified user, remove them from database if they haven't completed verification in due time
  for (let i = 0; i < unverifiedUsers.length; i++) {
    const userCreatedAt = new Date(unverifiedUsers[i].createdAt);
    const timeDifference = currentTime - userCreatedAt; // time difference in milliseconds
    //const twoMinutesInMilliseconds = 1000 * 60 * 2; // for testing purposes
    const fourWeeksInMilliseconds = 1000 * 60 * 60 * 24 * 28; // 28 days in milliseconds
    // console.log(timeDifference);
    // console.log(fourWeeksInMilliseconds);

    // check if 4 weeks have passed since user registration
    if (timeDifference >= fourWeeksInMilliseconds) {
      await User.findByIdAndDelete(unverifiedUsers[i].id);
      console.log(
        "User " +
          unverifiedUsers[i].id +
          " successfuly removed due to unverified account"
      );
    }
  }
});
