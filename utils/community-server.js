// community/communitySocket.js

const activeUsers = new Map();

function cleanUsername(username) {
  if (typeof username !== "string") return "";

  return username
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 30);
}

function cleanMessage(message) {
  if (typeof message !== "string") return "";

  return message
    .trim()
    .slice(0, 1000);
}

function setupCommunity(io) {
  io.on("connection", (socket) => {
    console.log(`Community connection: ${socket.id}`);

    socket.on("register-user", (rawUsername) => {
      const username = cleanUsername(rawUsername);

      if (!username) {
        socket.emit("registration-error", {
          message: "Please enter a valid username.",
        });
        return;
      }

      if (activeUsers.has(socket.id)) return;

      activeUsers.set(socket.id, username);

      socket.emit("registration-success", {
        socketId: socket.id,
        username,
      });

      broadcastOnlineUsers(io);

      io.emit("chat-message", {
        type: "system",
        system: true,
        message: `${username} joined the community.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("send-message", (rawMessage) => {
      const message = cleanMessage(rawMessage);

      if (!message) return;

      const username =
        activeUsers.get(socket.id) || "Anonymous";

      io.emit("chat-message", {
        type: "message",
        system: false,
        senderId: socket.id,
        senderName: username,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("typing", () => {
      const username = activeUsers.get(socket.id);

      if (!username) return;

      socket.broadcast.emit("user-typing", {
        socketId: socket.id,
        username,
      });
    });

    socket.on("stop-typing", () => {
      socket.broadcast.emit("user-stop-typing", {
        socketId: socket.id,
      });
    });

    socket.on("disconnect", (reason) => {
      const username = activeUsers.get(socket.id);

      if (!username) return;

      activeUsers.delete(socket.id);

      io.emit("chat-message", {
        type: "system",
        system: true,
        message: `${username} left the community.`,
        timestamp: new Date().toISOString(),
      });

      broadcastOnlineUsers(io);

      console.log(
        `${username} disconnected. ${reason}. Online: ${activeUsers.size}`
      );
    });
  });
}

function broadcastOnlineUsers(io) {
  const users = Array.from(activeUsers.entries()).map(
    ([socketId, username]) => ({
      socketId,
      username,
    })
  );

  io.emit("update-user-list", users);

  io.emit("online-count", {
    count: users.length,
  });
}

export { setupCommunity, activeUsers };
