// routes/adminRoles.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool } from "../config/db.js";

const router = Router();

router.get(
  "/roles",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const [rows] = await pool.query(
        `
        SELECT id, code, name
        FROM roles
        WHERE
          is_active = 1
          AND is_system = 0
          AND (company_id = :companyId OR company_id IS NULL)
        ORDER BY company_id IS NULL ASC, id DESC
        `,
        { companyId }
      );

      res.json({ rows: rows || [] });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
