import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import { getDynamicOnlineStudentsCount } from "./utils/live-counter.js";
import { setupCommunity } from "./utils/community-server.js";

// Initialize environment variables
dotenv.config();

// ============================================================
// EXPRESS APP
// ============================================================

const app = express();

// ============================================================
// HTTP SERVER
// ============================================================

const httpServer = createServer(app);

// ============================================================
// SOCKET.IO
// ============================================================

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://challengehub-testing-5yxs.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// ============================================================
// COMMUNITY SOCKET SYSTEM
// ============================================================

setupCommunity(io);

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "https://challengehub-testing-5yxs.vercel.app",
    ],
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
      "PATCH",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ============================================================
// BODY PARSERS
// ============================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    limit: "10mb",
    extended: true,
  })
);

// ============================================================
// API ROUTES
// ============================================================

app.use("/api/auth", authRoutes);

app.use("/api", dashboardRoutes);

app.use("/api/exam", examRoutes);

// ============================================================
// LIVE TRAFFIC
// ============================================================

app.get(
  "/api/live-traffic-counter",
  getDynamicOnlineStudentsCount
);

app.get(
  "/api/live-traffic",
  getDynamicOnlineStudentsCount
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/", (req, res) => {
  res.send("ChallengeHub server is running");
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ChallengeHub server running on port ${PORT}`
  );

  console.log(
    `Socket.IO community running on port ${PORT}`
  );
});

export { app, httpServer, io };
export default app;
