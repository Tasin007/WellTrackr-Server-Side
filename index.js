const express = require("express");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
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
    const forumCollection = client.db("WellTrackr").collection("forums");
    const reviewCollection = client.db("WellTrackr").collection("review");
    const appliedTrainerCollection = client.db("WellTrackr").collection("appliedTrainers");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token: token });
    });

     // Middleware to verify JWT token
     const verifyToken = (req, res, next) => {
      try {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader || typeof authorizationHeader !== "string") {
          return res.status(401).send({ message: "Unauthorized request" });
        }
        const token = authorizationHeader.split(" ")[1];
        console.log("Received token:", token);
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        req.user = decoded;
        next();
      } catch (error) {
        console.error(error);
        return res.status(401).send({ message: "Unauthorized request" });
      }
    };
    
    // Middleware to verify admin access
    const verifyAdmin = async (req, res, next) => {
      try {
        if (!req.user || !req.user.email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const email = req.user.email;
        const user = await userCollection.findOne({ email });

        if (!user) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        if (user.role !== "admin") {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        next();
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal server error" });
      }
    };
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

    
    //review related api
    app.get("/api/v1/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });
    app.post("/api/v1/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
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

    // admin related api
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.user.email) {
        return res.status(403).send({ message: "Unauthorized request" });
      }

      try {
        const query = { email };
        const user = await userCollection.findOne(query);

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const isAdmin = user.role === "admin";

        res.send({ admin: isAdmin });
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal server error" });
      }
    });

    // Route to post data to appliedTrainers collection
    app.post("/api/v1/appliedTrainers", async (req, res) => {
      try {
        // Assuming that req.body contains the data you want to add
        const newData = req.body;

        // Insert the data into the appliedTrainers collection
        const result = await appliedTrainerCollection.insertOne(newData);

        // Respond with a success message
        res.status(201).send({ message: "Data added to appliedTrainers collection", result });
      } catch (error) {
        // Handle any errors that occur during the insertion
        console.error(error);
        res.status(500).send({ message: "Error adding data to appliedTrainers collection" });
      }
    });

    // app.patch(
    //   "/users/admin/:id",
    //   verifyToken,
    //   verifyAdmin,
    //   async (req, res) => {
    //     const id = req.params.id;
    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = { $set: { role: "admin", role: "agent" } };
    //     const result = await userCollection.updateOne(filter, updatedDoc);
    //     res.send(result);
    //   }
    // );

    app.get("/users/admin/:email", verifyAdmin, async (req, res) => {
      console.log(202, req.params, req?.decoded?.email);
      const email = req?.params?.email;
      if (email !== req?.user?.email) {
        return res.status(403).send({ message: "Unauthorized request" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // Trainer related api
    app.get("/users/trainer/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.user.email) {
        return res.status(403).send({ message: "Unauthorized request" });
      }

      try {
        const query = { email };
        const user = await userCollection.findOne(query);

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const isTrainer = user.role === "trainer";

        res.send({ trainer: isTrainer });
      } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Internal server error" });
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

    // Fetch forum posts with pagination
    app.get("/api/v1/forums", async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 6;

        const cursor = forumCollection.find({}).sort({ createdAt: -1 });
        const count = await cursor.count();
        const forums = await cursor
          .skip(pageSize * (page - 1))
          .limit(pageSize)
          .toArray();

        res.status(200).send({ data: forums, total: count });
      } catch (error) {
        res.status(500).send(error);
      }
    });

    // Upvote a forum post
    app.put("/api/v1/forums/:id/upvote", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await forumCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { votes: 1 } } // Increment votes by 1
        );

        res.status(200).send(result);
      } catch (error) {
        res.status(400).send(error);
      }
    });

    // Downvote a forum post
    app.put("/api/v1/forums/:id/downvote", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await forumCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { votes: -1 } } // Decrement votes by 1
        );

        res.status(200).send(result);
      } catch (error) {
        res.status(400).send(error);
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
