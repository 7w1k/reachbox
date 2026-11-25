
import { Router, Request, Response } from "express";
import passport from "../config/passport";
import jwt from "jsonwebtoken";
import prisma from "../config/database";
import { authenticateToken, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Start Google OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// Google OAuth callback
router.get("/google/callback", (req: Request, res: Response, next) => {
  passport.authenticate(
    "google",
    { session: false },
    (error: Error | null, user: Express.User | false | null) => {
      if (error || !user) {
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
        );
      }

      const token = jwt.sign(
        {},
        process.env.JWT_SECRET!,
        {
          subject: (user as any).id,
          expiresIn: "7d",
        }
      );

      res.cookie("token", token, cookieOptions);

      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }
  )(req, res, next);
});

// Get logged-in user's profile
router.get(
  "/me",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({ user });
    } catch (error) {
      console.error("Profile error:", error);
      return res.status(500).json({ message: "Failed to fetch profile" });
    }
  }
);

// Logout
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });

  if (req.session) {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ message: "Logout failed" });
      }
      return res.json({ message: "Logged out successfully" });
    });
  } else {
    return res.json({ message: "Logged out successfully" });
  }
});

export default router;
