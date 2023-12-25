const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000


//middleware
app.use(cors());
app.use(express.json());


//mongo connection


const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cit9nsb.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // await client.connect();

    // const taskCollection = client.db("taskManagement").collection("allTasks")
    const userCollection = client.db("taskManagement").collection("users")
    app.get("/users", async (req, res) => {
        const users = await userCollection.find().toArray();
        res.send(users);
      });
    app.post("/users", async (req, res) => {
        const query = { email: req.body.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          res.send({ message: "user already exists", insertedId: null });
        } else {
          const newUser = req.body;
          const result = await userCollection.insertOne(newUser);
          res.send(result);
        }
      });

    //   app.get("/tasks", async (req, res) => {
    //     const tasks = await taskCollection.find().toArray();
    //     res.send(tasks);
    //   })

    //   app.post("/tasks", async (req, res) => {
    //     const newTask = req.body;
    //     const result = await taskCollection.insertOne(newTask);
    //     res.send(result);
    //         })
            
    // app.delete("/tasks/:id", async (req, res) => {
    //     const id = req.params.id;
    //     const query = { _id: new ObjectId(id) };
    //     const result = await taskCollection.deleteOne(query);
    //     res.send(result);
    //   });
    //   app.put("/tasks/:id", async (req, res) => {
    //     const id = req.params.id;
    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = { $set: req.body };
    //     const result = await taskCollection.updateOne(filter, updatedDoc);
    //     res.send(result);
    //   });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('WellTrackr is available now')
})

app.listen(port, () => {
  console.log(`WellTrackr is running on port ${port}`)
})