const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server,{
  cors: {
    origin: true,
    credentials: true,
  },
  allowEIO3: true,
});

const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb+srv://travalapp:travalapp@cluster0.oz5xxmc.mongodb.net/',{ useNewUrlParser: true, useUnifiedTopology: true });

// Create a Mongoose schema for comments
const commentSchema = new mongoose.Schema({
  name: String,
  message: String,
  replies: [
    {
      name: String,
      message: String,
    },
  ],
});

// Create a Mongoose schema for restaurants
const restaurantSchema = new mongoose.Schema({
  restaurantId: Number,
  comments: [commentSchema],
});
const reasturentUser = new mongoose.Schema({
  name: String,
  password: String,
  gmail: String
});

const Restaurant = mongoose.model('Restaurant', restaurantSchema);
const User = mongoose.model('reasturentUser', reasturentUser);
// Socket.io connection event
io.on('connection', (socket) => {
  console.log('A user connected');

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

  // Handle the socket event to add a new comment
  socket.on('addComment', async ({ restaurantId, newComment }) => {
    try {
      let restaurant = await Restaurant.findOne({ restaurantId });

      if (!restaurant) {
        // If the restaurant doesn't exist, create a new one
        restaurant = new Restaurant({
          restaurantId,
          comments: [newComment],
        });
      } else {
        // If the restaurant exists, add the comment
        restaurant.comments.push(newComment);
      }

      await restaurant.save();
      let allData = await Restaurant.find({});

      // Emit a socket event to notify connected clients about the new comment
      io.emit('newComment', restaurant);
    } catch (error) {
      console.error(error);
      // Handle errors
    }
  });

  // Handle the socket event to add a reply
  socket.on('addReply', async ({ restaurantId, commentIndex, newReply }) => {
    try {
      const restaurant = await Restaurant.findOne({ restaurantId });
      if (!restaurant || !restaurant.comments[commentIndex]) {
        res.status(404).send('Restaurant or comment not found');
        return;
      }

      // If the restaurant and comment exist, add the reply
      restaurant.comments[commentIndex].replies.push(newReply);
      await restaurant.save();

      // Emit a socket event to notify clients about the new reply
      io.emit('newReply', restaurant);
    } catch (error) {
      console.error(error);
      socket.emit('replyError', 'Internal Server Error');
    }
  });

  socket.on('requestInitialData', async ({ restaurantId }) => {
    try {
      const restaurant = await Restaurant.findOne({ restaurantId });

      if (restaurant) {
        // If the restaurant exists, emit the initial data
        socket.emit('initialData', restaurant);
      }
    } catch (error) {
      console.error(error);
    }
  });
});


app.post('/create/users', async (req, res) => {
  const { name, password, gmail } = req.body;

  // Basic validation (you should add more)
  if (!name || !password || !gmail) {
    return res.status(400).json({ error: 'Invalid request. Missing required fields.' });
  }

  // Create a new user and save it to MongoDB
  const newUser = new User({ name, password, gmail });

  try {
    const savedUser = await newUser.save();
    return res.status(201).json({ message: 'User created successfully.', user: savedUser });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

app.post('/api/login',async (req, res) => {
  const { gmail, password } = req.body;

  // Basic validation (you should add more)
  if (!gmail || !password) {
    return res.status(400).json({ error: 'Invalid request. Missing required fields.' });
  }

  // Find the user in the in-memory storage (replace this with database lookup)
  const user = await User.findOne({ gmail, password });
  console.log(user.name);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. User not found or incorrect password.' });
  }

  return res.status(200).json({ message: 'Login successful.', user });
});




app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
