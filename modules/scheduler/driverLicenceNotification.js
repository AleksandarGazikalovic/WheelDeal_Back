const cron = require("node-cron");
const Notification = require("../../models/Notification");
const User = require("../../models/User");

// description: send a message to the user when the registration license expires in a month
// target group: users with registration license expires in a month
// argument "5 0 * * *": triggers every day at 00:10
// TESTING: for testing use argument "*/10 * * * * *" -> triggers every 10 seconds
const job = cron.schedule("10 0 * * *", async () => {
  const expiredLicenceTime1 = new Date();
  expiredLicenceTime1.setMonth(expiredLicenceTime1.getMonth() + 1);
  const expiredLicenceTime2 = new Date(expiredLicenceTime1);
  expiredLicenceTime2.setDate(expiredLicenceTime2.getDate() + 1);
  const users = await User.find({
    driverLicenseExpiredDate: {
      $gt: expiredLicenceTime1, // Greater than expiredLicenceTime1
      $lt: expiredLicenceTime2, // Less than expiredLicenceTime2
    },
  });

  if (users == null || users.length === 0) {
    job.stop();
    console.log("Cron job stopped because users are null or empty.");
    return;
  }

  const title = "Vozačka dozvola blizu isteka!";
  const content =
    "Vaša vozačka dozvola ističe za mesec dana. Molim Vas da kada obnovite vašu vozačku dozvolu," +
    " aržurirajte podatke na platformi. Unapred hvala, vaš WheelDeal";
  const createdAt = new Date();

  for (let i = 0; i < users.length; i++) {
    const newNotification = new Notification({
      user: users[i].id,
      title: title,
      content: content,
      isOpened: false,
      notificationType: "general",
    });
    try {
      await newNotification.save();
      console.log(
        "New notification saved successfully for user: " +
          users[i].name +
          users[i].surname
      );
    } catch (err) {
      console.error("Error saving notification:", err);
    }
  }
});
