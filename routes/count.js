const router = require("express").Router();
const Host = require("../models/Host");
const Client = require("../models/Client");

router.post("/addHost", async (req, res) => {
  try {
    const newHost = new Host({
      age: req.body.age,
      reason: req.body.reason,
    });

    // save user and respond
    const host = await newHost.save();
    res.status(200).json(host);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "An error occurred during adding host" });
  }
});

router.post("/addClient", async (req, res) => {
  try {
    const newClient = new Client({
      age: req.body.age,
      reason: req.body.reason,
    });

    // save user and respond
    const client = await newClient.save();
    res.status(200).json(client);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "An error occurred during adding client" });
  }
});

router.get("/count", async (req, res) => {
  try {
    const hostCount = await Host.countDocuments();
    const clientCount = await Client.countDocuments();

    res.status(200).json({ hostCount, clientCount });
  } catch (error) {
    console.error("Error counting hosts and clients:", error);
    res.status(500).json({ error: "Error counting hosts and clients" });
  }
});

module.exports = router;
