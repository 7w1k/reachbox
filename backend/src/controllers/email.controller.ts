
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import { scheduleEmails } from "../services/email.service";
import { AuthRequest } from "../middleware/auth.middleware";

const scheduleSchema = z.object({
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.string().datetime(),
  delaySeconds: z.number().int().min(0),
});

export async function scheduleEmailController(
  req: AuthRequest,
  res: Response
) {
  try {
    const parsed = scheduleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: parsed.error.flatten(),
      });
    }

    const userId = req.userId!;
    const result = await scheduleEmails({
      ...parsed.data,
      userId,
      startTime: new Date(parsed.data.startTime),
    });

    return res.status(201).json({
      success: true,
      message: "Emails scheduled successfully",
      data: result,
    });
  } catch (error) {
    console.error("Schedule email error:", error);

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function getScheduledEmails(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = String(req.userId! || "");

    if (!z.string().uuid().safeParse(userId).success) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: {
          in: ["SCHEDULED", "PROCESSING"],
        },
      },
      include: {
        sender: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    console.error("Get scheduled emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch scheduled emails",
    });
  }
}

export async function getSentEmails(
  req: AuthRequest,
  res: Response
) {
  try {
    const userId = String(req.userId! || "");

    if (!z.string().uuid().safeParse(userId).success) {
      return res.status(400).json({
        success: false,
        message: "Valid userId is required",
      });
    }

    const emails = await prisma.email.findMany({
      where: {
        userId,
        status: "SENT",
      },
      include: {
        sender: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        sentAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: emails.length,
      data: emails,
    });
  } catch (error) {
    console.error("Get sent emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch sent emails",
    });
  }
}
