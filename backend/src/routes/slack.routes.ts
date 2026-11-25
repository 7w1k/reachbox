import { Router } from "express";
import {
  connectSlack,
  slackCallback,
  slackStatus,
} from "../controllers/slack.controller";

const router = Router();

router.get("/connect", connectSlack);
router.get("/callback", slackCallback);
router.get("/status", slackStatus);

export default router;