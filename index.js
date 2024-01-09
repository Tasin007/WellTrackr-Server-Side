const express = require("express");
const app = express();
require("dotenv").config();
const SSLCommerzPayment = require("sslcommerz-lts")
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


const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS;
const is_live = false //true for live, false for sandbox


async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const userCollection = client.db("WellTrackr").collection("users");
    const classCollection = client.db("WellTrackr").collection("classes");
    const trainerCollection = client.db("WellTrackr").collection("trainers");
    const forumCollection = client.db("WellTrackr").collection("forums");
    const reviewCollection = client.db("WellTrackr").collection("review");
    const appliedTrainerCollection = client
      .db("WellTrackr")
      .collection("appliedTrainers");
    const plansCollection = client.db("WellTrackr").collection("plans");
    const addClassCollection = client.db("WellTrackr").collection("addClass");
    const paymentPlansCollection = client.db("WellTrackr").collection("paymentPlans");

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
        // console.log("Received token:", token);
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
      // console.log(55, req.body.email);
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        // console.log(58, existingUser);
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
      // console.log(202, req.params, req?.decoded?.email);
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

    // Route to post data to appliedTrainers collection
    app.post("/api/v1/appliedTrainers", async (req, res) => {
      try {
        // Assuming that req.body contains the data you want to add
        const newData = req.body;

        // Insert the data into the appliedTrainers collection
        const result = await appliedTrainerCollection.insertOne(newData);

        // Respond with a success message
        res.status(201).send({
          message: "Data added to appliedTrainers collection",
          result,
        });
      } catch (error) {
        // Handle any errors that occur during the insertion
        console.error(error);
        res
          .status(500)
          .send({ message: "Error adding data to appliedTrainers collection" });
      }
    });

    // API endpoint to get all applied trainers
    app.get("/api/v1/appliedTrainers", async (req, res) => {
      try {
        // Fetch all applied trainers from the collection
        const appliedTrainers = await appliedTrainerCollection.find().toArray();
        res.status(200).send(appliedTrainers);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // API endpoint to get all plans
    app.get("/api/v1/plans", async (req, res) => {
      try {
        // Fetch all plans from the collection
        const plans = await plansCollection.find().toArray();
        res.status(200).send(plans);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Internal server error" });
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
    // API endpoint to post forum data
    app.post("/api/v1/forums", async (req, res) => {
      try {
        const forumData = req.body;
        // You can add createdAt here using server time if needed
        // forumData.createdAt = new Date().toISOString();

        // Insert the forum data into the forumCollection
        const result = await forumCollection.insertOne(forumData);

        // Respond with a success message and the inserted forum data
        res.status(201).send({
          message: "Forum data added successfully",
          data: result.ops[0],
        });
      } catch (error) {
        // Handle any errors that occur during the insertion
        console.error(error);
        res.status(500).send({ message: "Error adding forum data" });
      }
    });

    //addClassCollection get method
    app.get("/api/v1/addClass", async (req, res) => {
      const result = await addClassCollection.find().toArray();
      res.send(result);
    });
    //addClassCollection post method
    app.post("/api/v1/addClass", async (req, res) => {
      
        const addClassData = req.body;
        
        const result = await addClassCollection.insertOne(addClassData);
        res.send(result);
    })

    // put method

    app.put("/api/v1/addClass/:id", async (req, res) => {
     
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      
      // Validate if the request body contains the necessary fields
      const { name, category, yearsOfExperience, availableHours, image, facebook, twitter, linkedin, description, time } = req.body;
      // console.log("443:Request Body:", req.body);
      
        const result = await addClassCollection.updateOne(query, {
          $set: req.body,
        });
    
        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Class not found for the provided ID." });
        }
    
        // Send back a more informative response, e.g., the updated document
        const updatedClass = await addClassCollection.findOne(query);
      res.send(updatedClass);
    });
    

// admin
app.patch(
  "/api/v1/users/make-admin/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const userId = req.params.id;
    const filter = { _id: new ObjectId(userId) };
    const updatedDoc = { $set: { role: "admin" } };

    try {
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    } catch (error) {
      console.error("Error making user admin:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.patch(
  "/api/v1/users/make-agent/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const userId = req.params.id;
    // console.log(356, userId);
    const filter = { _id: new ObjectId(userId) };
    const updatedDoc = { $set: { role: "trainer" } };

    try {
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    } catch (error) {
      console.error("Error making user agent:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.delete("/api/v1/users/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  try {
    const result = await userCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Internal Server Error");
  }
});

//payment
const tran_id = new ObjectId().toString();

function generateRandomNumberString(length) {
  const numbers = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    result += numbers.charAt(randomIndex);
  }
  return result;
}

const NID = generateRandomNumberString(12);
//payment get
app.get("/payment", async (req, res) => {
  const payment = await paymentPlansCollection.find().toArray();
  res.send(payment);
});
// app.post("/payment", async (req, res) => {
//   try {
//     const product = await plansCollection.findOne({ _id: new ObjectId(req.body.planId) });

//     console.log("Product:", product);
//     const data = {
//       total_amount: product?.price,
//       currency: 'BDT',
//       tran_id: tran_id,
//       success_url: 'http://localhost:3030/success',
//       fail_url: 'http://localhost:3030/fail',
//       cancel_url: 'http://localhost:3030/cancel',
//       ipn_url: 'http://localhost:3030/ipn',
//       shipping_method: 'Courier',
//       product_name: product?.name,
//       product_category: product?._id,
//       product_profile: product?.description,
//       cus_name: 'Customer Name',
//       cus_email: 'customer@example.com',
//       cus_add1: 'Dhaka',
//       // Add other customer details
//       nid_number: NID,
//       ship_name: 'Customer Name',
//       // Add other shipping details
//       // receivedData: req.body,
//     };

//     console.log("Payment data:", data);

//     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
//     const apiResponse = await sslcz.init(data);

//     let GatewayPageURL = apiResponse.GatewayPageURL;

//     const finalOrder = {
//       paidStatus: false,
//       transactionId: tran_id,
//       userEmail: req.body.userEmail,
//       userName: req.body.userName,
//       planName: product?.name,
//       planPrice: product?.price,
//       planDescription: product?.description,
//     };
//     console.log("Final Order:", finalOrder);

//     const result = await paymentPlansCollection.insertOne(finalOrder);
//     res.send({ url: GatewayPageURL });
//     console.log("Redirecting to: ", GatewayPageURL);
//   } catch (error) {
//     console.error("Error processing payment:", error);
//     res.status(500).send({ error: "Internal Server Error" });
//   }
// });

app.post("/payment", async (req, res) => {
    const order = await plansCollection.findOne({
      _id: new ObjectId(req.body.planId),
    });
      // console.log("589: Order:", order);

     if(!order){
       return res.status(404).send({message: "Order not found"});
     }

     const pay = req.body;
    //  console.log("596: Pay:", pay);

     const data = {
      total_amount: order.price || 0, // Set total_amount dynamically based on property price
      currency: "BDT",
      tran_id: tran_id, // use unique tran_id for each api call
      success_url: `http://localhost:5000/payment/success/${tran_id}`,
      fail_url: `http://localhost:5000/payment/fail/${tran_id}`,
      cancel_url: `http://localhost:5000/payment/cancel/${tran_id}`,
      ipn_url: "http://localhost:5000/ipn",
      shipping_method: "Courier",
      product_name: order.name,
      product_category: "Electronic",
      product_profile: "general",
      cus_name: pay.userName,
      cus_email: pay.userEmail,
      cus_NID: NID,
      plan_id: pay.planId,
      cus_city: "Dhaka",
      cus_state: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: "01711111111",
      cus_fax: "01711111111",
      ship_name: "Customer Name",
      ship_add1: "Dhaka",
      ship_add2: "Dhaka",
      ship_city: "Dhaka",
      ship_state: "Dhaka",
      ship_postcode: 1000,
      ship_country: "Bangladesh",
    };

    console.log("Data:", data);

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
    sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })

        const finalOrder = {
          transactionId: tran_id,
          plan_id: pay.planId,
          userEmail: pay.userEmail,
          userName: pay.userName,
          planName: order.name,
          planPrice: order.price,
          userNID: NID,
          paidStatus: false,
        };
        const result = paymentPlansCollection.insertOne(finalOrder);
        console.log('Redirecting to: ', GatewayPageURL)
    });

    app.post("/payment/success/:tranId", async (req, res) => {
      console.log("Payment success:", req.params.tranId);
      const result = await paymentPlansCollection.updateOne(
        { transactionId: req.params.tranId },
        {
          $set: {
            paidStatus: true,
            successDate: new Date(),
          },
        }
      );
      if (result.modifiedCount > 0) {
        res.redirect(
          `http://localhost:5173/payment/success/${req.params.tranId}`
        );
      } else {
        res.send("Payment failed");
      }
    });
    app.post("/payment/fail/:tranId", async (req, res) => {
      const result = await paymentPlansCollection.deleteOne({
        transactionId: req.params.tranId,
      });

      if (result.deletedCount) {
        res.redirect(
          `http://localhost:5173/payment/fail/${req.params.tranId}`
        );
      } else {
        res.send("Payment failed");
      }
    });


})




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
