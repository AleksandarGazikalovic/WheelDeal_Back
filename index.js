const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const userRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const postRoute = require("./routes/posts");
const countRoute = require("./routes/count");
const cors = require("cors");

dotenv.config();

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

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

app.use("/api/users", userRoute);
app.use("/api/auth", authRoute);
app.use("/api/posts", postRoute);
app.use("/api/count", countRoute);

app.listen(8800, () => {
  console.log("Server started!");
});

// const express = require("express"); // Import express
// const mongoose = require("mongoose");
// const dotenv = require("dotenv");
// const helmet = require("helmet");
// const morgan = require("morgan");
// const userRoute = require("./routes/users");
// const authRoute = require("./routes/auth");
// const postRoute = require("./routes/posts");
// const countRoute = require("./routes/count");
// const https = require('https');
// const fs = require('fs');

// dotenv.config();

// const app = express(); // Create an instance of Express

// const options = {
//   key: fs.readFileSync('/etc/letsencrypt/live/wheeldeal.rent/privkey.pem'),
//   cert: fs.readFileSync('/etc/letsencrypt/live/wheeldeal.rent/fullchain.pem'),
//   // Other TLS options, e.g., protocol versions and ciphers
// };

// mongoose.connect(process.env.MONGO_URL, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// app.use(express.json());
// app.use(helmet());
// app.use(morgan("common"));
// app.use("/api/users", userRoute);
// app.use("/api/auth", authRoute);
// app.use("/api/posts", postRoute);
// app.use("/api/count", countRoute);

// const server = https.createServer(options, app);

// server.listen(8800, () => {
//   console.log('Server is running on port 8800 (HTTPS)');
// });
