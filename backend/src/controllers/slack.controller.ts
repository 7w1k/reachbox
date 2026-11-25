
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import {
  generateSlackOAuthUrl,
  handleSlackCallback,
} from "../integrations/slack";
import { AuthRequest } from "../middleware/auth.middleware";

// Start Slack OAuth connection
export async function connectSlack(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const url = await generateSlackOAuthUrl(user.id);
    return res.redirect(url);
  } catch (error) {
    console.error("Slack connect error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start Slack connection",
    });
  }
}

// Slack OAuth callback (public endpoint; validates OAuth state)
export async function slackCallback(req: Request, res: Response) {
  const parsed = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }).safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid OAuth parameters",
    });
  }

  try {
    const result = await handleSlackCallback(
      parsed.data.code,
      parsed.data.state
    );

    return res.status(200).json({
      success: true,
      message: "Slack connected successfully",
      data: result,
    });
  } catch (error) {
    console.error("Slack callback error:", error);
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Slack connection failed",
    });
  }
}

// Get current user's Slack connection status
export async function slackStatus(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        teamId: true,
        teamName: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      connected: Boolean(connection),
      data: connection,
    });
  } catch (error) {
    console.error("Slack status error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to check Slack connection",
    });
  }
}
