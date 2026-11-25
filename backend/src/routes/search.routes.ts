
import { Router } from "express";
import { searchEmailController } from "../controllers/search.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticateToken, searchEmailController);

export default router;