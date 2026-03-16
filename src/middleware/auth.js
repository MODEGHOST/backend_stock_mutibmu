import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
