const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const userRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const postRoute = require("./routes/posts");
const commentRoute = require("./routes/comments");
const cors = require("cors");
const path = require("path");
const https = require("https");
const fs = require("fs");
const bodyParser = require('body-parser');
const morganBody = require('morgan-body');
const cookieParser = require('cookie-parser');

// dotenv.config();
//MongoDB Connection, to prod or dev database
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: `.env.production` })
  mongoose.connect(process.env.MONGO_URL_PROD, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}
else {
  dotenv.config({ path: `.env.development` })
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
const logStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

app.use(bodyParser.json());
morganBody(app, { stream: logStream, noColors: true });


app.use(
  cors({
    origin: FRONTEND_URL, // Replace with your desired origin(s) or use a function to check request origin dynamically
    methods: "GET, OPTIONS, POST",
    credentials: true,
    allowedHeaders:
      "Authorization, Origin, X-Requested-With, Content-Type, Accept",
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.use("/api/users", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/posts", postRoute);
app.use("/api/comments", commentRoute);

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
  });
} else {
  // If not in production, use regular HTTP
  app.listen(8800, () => {
    console.log("HTTP Server started in development!");
  });
}
