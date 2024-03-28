const AppError = require("../modules/errorHandling/AppError");

const errorHandler = (error, req, res, next) => {
  console.log(error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      //   errorCode: error.errorCode,
      message: error.message,
    });
  }

  //   console.log(error.message);
  return res.status(500).send("Something went wrong");
};

module.exports = errorHandler;
