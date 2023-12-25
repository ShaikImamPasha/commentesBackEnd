const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3002;

const options = {
  origin: 'https://commentes.vercel.app',
  credentials: true,
  methods: ["GET", "POST"],
  transports: ['websocket', 'polling']
}

app.use(cors(options));
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(mongooUrl,{ useNewUrlParser: true, useUnifiedTopology: true });

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

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
