
import { Router } from "express";
import {
  connectSlack,
  slackCallback,
  slackStatus,
} from "../controllers/slack.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.get("/connect", authenticateToken, connectSlack);
router.get("/callback", slackCallback);
router.get("/status", authenticateToken, slackStatus);

export default router;
