
import express from "express";
import cors from "cors";
import emailRoutes from "./routes/email.routes";
import searchRoutes from "./routes/search.routes";
import slackRoutes from "./routes/slack.routes";
import adminRoutes from "./routes/admin.routes";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/passport";
import authRoutes from "./routes/auth.routes";
import senderRoutes from "./routes/sender.routes";




const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use("/api/auth", authRoutes);
app.use(express.json({ limit: "5mb" }));
app.use("/api/search", searchRoutes);
app.use("/api/senders", senderRoutes);
app.use("/admin/queues", adminRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api/emails", emailRoutes);
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ReachInbox API is running",
    timestamp: new Date().toISOString(),
  });
});

export default app;
