const { Scopes } = require("dioma");

class DateConverter {
  // Single instance of the class for the entire application
  static scope = Scopes.Singleton();

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
