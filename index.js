const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cit9nsb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const userCollection = client.db("WellTrackr").collection("users");
    const classCollection = client.db("WellTrackr").collection("classes");
    const trainerCollection = client.db("WellTrackr").collection("trainers");

    // User Routes
    app.get("/api/v1/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/api/v1/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const users = await userCollection.findOne(query);
      res.send(users);
    });

    app.post("/api/v1/users", async (req, res) => {
      const query = { email: req.body.email };
      console.log(55, req.body.email);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        console.log(58, existingUser);
        res.send({ message: "user already exists", insertedId: null });
      } else {
        const newUser = req.body;
        const result = await userCollection.insertOne(newUser);
        res.send(result);
      }
    });

    app.put("/api/v1/users", async (req, res) => {
      const query = { email: req.body.email };
      const existingUser = await userCollection.findOne(query);
      if (!existingUser) {
        res.send({ message: "user does not exists", insertedId: null });
      } else {
        const result = await userCollection.updateOne(query, {
          $set: req.body,
        });
        res.send(result);
      }
    });

    app.delete("/api/v1/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Class Routes
    app.get("/classes", async (req, res) => {
      const classes = await classCollection.find().toArray();
      res.send(classes);
    });

    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    });

    // Enroll a user in a class
    app.post("/enroll", async (req, res) => {
      const { userId, classId } = req.body;
      const userObjectId = new ObjectId(userId);
      const classObjectId = new ObjectId(classId);

      const updateUserResult = await userCollection.updateOne(
        { _id: userObjectId },
        { $addToSet: { enrolledClasses: classObjectId } }
      );

      const updateClassResult = await classCollection.updateOne(
        { _id: classObjectId },
        { $inc: { members: 1 } }
      );

      if (
        updateUserResult.modifiedCount === 1 &&
        updateClassResult.modifiedCount === 1
      ) {
        res.status(200).send({ message: "Enrolled successfully" });
      } else {
        res.status(400).send({ message: "Unable to enroll" });
      }
    });

    // Create a new Trainer profile
    app.post("/api/v1/trainers", async (req, res) => {
      try {
        const newTrainer = req.body;
        const result = await trainerCollection.insertOne(newTrainer);
        res.status(201).send(result);
      } catch (error) {
        res.status(400).send(error);
      }
    });

    // Get all Trainer profiles
    app.get("/api/v1/trainers", async (req, res) => {
      try {
        const trainers = await trainerCollection.find().toArray();
        res.status(200).send(trainers);
      } catch (error) {
        res.status(500).send(error);
      }
    });

    // Get Trainer details by ID
    app.get("/api/v1/trainers/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const trainer = await trainerCollection.findOne(query);
        res.status(200).send(trainer);
      } catch (error) {
        res.status(500).send(error);
      }
    });
  } finally {
    // Uncomment the following line if you want to close the connection after each operation
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("WellTrackr Server is Running");
});

app.listen(port, () => {
  console.log(`WellTrackr Server is listening on port ${port}`);
});
