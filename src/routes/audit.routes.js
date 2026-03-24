import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool } from "../config/db.js";

const router = Router();

router.get("/", auth, requirePermission("system.settings.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const q = req.query.q ? String(req.query.q).trim() : "";
    const action = req.query.action ? String(req.query.action) : null;
    const entity_type = req.query.entity_type ? String(req.query.entity_type) : null;
    
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a.company_id = :companyId`;
    const params = { companyId, limit, offset };

    if (q) {
      whereClause += ` AND (u.first_name LIKE :q OR u.last_name LIKE :q OR a.entity_id LIKE :q)`;
      params.q = `%${q}%`;
    }
    if (action) {
      whereClause += ` AND a.action = :action`;
      params.action = action;
    }
    if (entity_type) {
      whereClause += ` AND a.entity_type = :entity_type`;
      params.entity_type = entity_type;
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total 
       FROM audit_logs a 
       LEFT JOIN users u ON u.id = a.user_id 
       ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
              u.first_name, u.last_name, u.email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    res.json({ rows, total });
  } catch (e) {
    next(e);
  }
});

export default router;
