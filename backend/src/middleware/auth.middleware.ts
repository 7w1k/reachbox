
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;

    if (typeof decoded.sub !== "string") {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.userId = decoded.sub;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
