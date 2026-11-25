
import { Router } from "express";
import { getSenders } from "../controllers/sender.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticateToken, getSenders);

export default router;
