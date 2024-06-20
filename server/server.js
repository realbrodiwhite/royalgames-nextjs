const express = require('express');

class Server {
  constructor() {
    const port = process.env.PORT || 8080;
    const app = express();
    const http = require('http');
    const server = http.createServer(app);
    const { Server: SocketIoServer } = require('socket.io');
    const io = new SocketIoServer(server, {
      cors: {
        origin: "*",
      },
    });

    app.use(express.static(__dirname + '/build'));

    app.get('/', (req, res) => {
      res.sendFile(__dirname + '/build/index.html');
    });

    app.use((req, res) => {
      res.sendFile(__dirname + '/build/index.html');
    });

    io.on('connection', (socket) => {
      console.log('a user connected');
      socket.on('disconnect', () => {
        console.log('user disconnected');
      });
    });

    this.app = app;
    this.server = server;
    this.io = io;
    this.port = port;
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`App listening on port ${this.port}`);
    });

    return this.io;
  }
}

module.exports = Server;