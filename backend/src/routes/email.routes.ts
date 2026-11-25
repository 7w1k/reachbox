
import {Router} from "express";
import { authenticateToken } from "../middleware/auth.middleware";

import {
  scheduleEmailController,
  getScheduledEmails,
  getSentEmails,
} from "../controllers/email.controller";

const router = Router();

router.post("/schedule", authenticateToken, scheduleEmailController);

router.get("/scheduled", authenticateToken, getScheduledEmails);

router.get("/sent", authenticateToken, getSentEmails);

export default router;
