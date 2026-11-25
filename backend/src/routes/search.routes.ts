
import { Router } from "express";
import {
  connectSlack,
  slackCallback,
  slackStatus,
} from "../controllers/slack.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Login required
router.get("/connect", authenticateToken, connectSlack);

// Public callback: OAuth state is validated by the service
router.get("/callback", slackCallback);

// Login required
router.get("/status", authenticateToken, slackStatus);

export default router;
