
import { Response } from "express";
import prisma from "../config/database";
import { AuthRequest } from "../middleware/auth.middleware";

export async function getSenders(req: AuthRequest, res: Response) {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        email: true,
        name: true,
        hourlyLimit: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      success: true,
      data: senders,
    });
  } catch (error) {
    console.error("Get senders error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load senders",
    });
  }
}
