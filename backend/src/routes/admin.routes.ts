
import { Router, Request, Response, NextFunction } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "../queues/email.queue";

const router = Router();

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

function protectDashboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const username = process.env.BULL_BOARD_USERNAME;
  const password = process.env.BULL_BOARD_PASSWORD;

  if (!username || !password) {
    return res.status(503).send("Dashboard credentials are not configured");
  }

  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    return res.status(401).send("Authentication required");
  }

  const decoded = Buffer.from(auth.slice(6), "base64").toString();
  const separator = decoded.indexOf(":");

  const providedUsername = decoded.slice(0, separator);
  const providedPassword = decoded.slice(separator + 1);

  if (
    separator === -1 ||
    providedUsername !== username ||
    providedPassword !== password
  ) {
    return res.status(401).send("Invalid credentials");
  }

  next();
}

router.use(protectDashboard);
router.use("/", serverAdapter.getRouter());

export default router;
