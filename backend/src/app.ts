
import express from "express";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ReachInbox API is running",
    timestamp: new Date().toISOString(),
  });
});

export default app;
