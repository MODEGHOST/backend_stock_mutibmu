import express from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as service from "../services/company.service.js";

const router = express.Router();

// GET /settings - Get company info & doc configs
router.get("/settings", auth, requirePermission("master.company.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1; // Default to 1 if not in token
    const data = await service.getCompanySettings(companyId);
    res.json(data);
  } catch (e) {
    next(e);
  }
});

// PUT /settings - Update company info
router.put("/settings", auth, requirePermission("master.company.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    await service.updateCompany(companyId, req.body);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// PUT /doc-configs - Update doc config
router.put("/doc-configs", auth, requirePermission("master.company.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    // Body: { doc_type: 'QT', prefix: 'Q-', reset_policy: 'YEARLY' }
    await service.updateDocConfig(companyId, req.body.doc_type, req.body);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
