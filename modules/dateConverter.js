const dependencyContainer = require("./dependencyContainer");

class DateConverter {
  // Single instance of the class for the entire application
  constructor() {
    // console.log("Initializing date converter...");
    dependencyContainer.register("dateConverter", this);
  }

  async convertDateToUTC(date) {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );
  }
}

module.exports = DateConverter;
