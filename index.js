const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");

const repositoryInitializer = require("./repositories/repositoryInitializer");
const serviceInitializer = require("./services/serviceInitializer");

const { createAuthRoutes } = require("./routes/auth");
const { createUserRoutes } = require("./routes/users");
const { createPostRoutes } = require("./routes/posts");
const { createVehicleRoutes } = require("./routes/vehicles");
const { createCommentRoutes } = require("./routes/comments");
const { createBookingRoutes } = require("./routes/bookings");

const cors = require("cors");
const path = require("path");
const https = require("https");
const fs = require("fs");
const bodyParser = require("body-parser");
const morganBody = require("morgan-body");
const cookieParser = require("cookie-parser");
const scheduler = require("./modules/scheduler/index");
const Post = require("./models/Post");
const errorHandler = require("./middleware/errorHandler");

// dotenv.config();
//MongoDB Connection, to prod or dev database
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` });
  mongoose.connect(process.env.MONGO_URL_PROD, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
} else {
  dotenv.config({ path: `.env.development` });
  mongoose.connect(process.env.MONGO_URL_DEV, {
    dbName: "WheelDealDev",
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}
let FRONTEND_URL = process.env.FRONTEND_URL;

// Express App Configuration
app.use(express.json());
app.use(helmet());
app.use(cookieParser());
// app.use(morgan("common"));

// Create a write stream to a log file
const logStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
  flags: "a",
});

app.use(bodyParser.json());
morganBody(app, { stream: logStream, noColors: true });

app.use(
  cors({
    origin: FRONTEND_URL, // Replace with your desired origin(s) or use a function to check request origin dynamically
    methods: "GET, OPTIONS, POST, PUT, PATCH, DELETE",
    credentials: true,
    allowedHeaders:
      "Authorization, Origin, X-Requested-With, Content-Type, Accept",
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", createAuthRoutes());
app.use("/api/posts", createPostRoutes());
app.use("/api/users", createUserRoutes());
app.use("/api/vehicles", createVehicleRoutes());
app.use("/api/comments", createCommentRoutes());
app.use("/api/bookings", createBookingRoutes());

app.use(errorHandler);

// Check if the environment is production
if (process.env.NODE_ENV === "production") {
  const options = {
    key: fs.readFileSync("/certs/live/wheeldeal.rent/privkey.pem"),
    cert: fs.readFileSync("/certs/live/wheeldeal.rent/fullchain.pem"),
    // Other TLS options, e.g., protocol versions and ciphers
  };

  const server = https.createServer(options, app);

  server.listen(8800, () => {
    console.log("HTTPS Server started in production!");

    // Will create index in production for collection 'posts', same as the current index on dev for that same collection
    // Function fires only once, if index already exists it does nothing
    Post.collection.createIndex({
      "location.searchStreet": 1,
      "location.searchCity": 1,
      isArchived: 1,
      from: 1,
      to: 1,
      price: 1,
    });
  });
} else {
  // If not in production, use regular HTTP
  app.listen(8800, () => {
    console.log("HTTP Server started in development!");
    // Post.collection.createIndex({
    //   "location.searchStreet": 1,
    //   "location.searchCity": 1,
    //   isArchived: 1,
    //   from: 1,
    //   to: 1,
    //   price: 1,
    // });

    // Post.collection.getIndexes().then((result) => {
    //   console.log(result);
    // });

    // Post.collection.dropIndex(
    //   "location.searchStreet_1_location.searchCity_1_isArchived_1_brand_1_from_1_to_1_price_1"
    // );
  });
}
