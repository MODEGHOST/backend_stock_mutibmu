import { hasPermission } from "../services/rbac.service.js";

export function requirePermission(code) {
  return async (req, res, next) => {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const ok = await hasPermission(userId, code);
    if (!ok) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
