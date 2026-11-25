
import { Response } from "express";
import { z } from "zod";
import { searchEmails } from "../services/email-search.service";
import { AuthRequest } from "../middleware/auth.middleware";

export async function searchEmailController(
  req: AuthRequest,
  res: Response
) {
  try {
    const schema = z.object({
      q: z.string().trim().min(1).max(200),
    });

    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "A valid search query is required",
      });
    }

    const userId = req.userId!;
    const { q } = parsed.data;

    const results = await searchEmails(userId, q);

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Email search error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to search emails",
    });
  }
}
