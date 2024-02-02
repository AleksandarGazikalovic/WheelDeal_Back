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

dotenv.config();

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Express App Configuration
app.use(express.json());
app.use(helmet());
app.use(morgan("common"));

app.use(
  cors({
    origin: "*", // Replace with your desired origin(s) or use a function to check request origin dynamically
    methods: "GET, OPTIONS",
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
