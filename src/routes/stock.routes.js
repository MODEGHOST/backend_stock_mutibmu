import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { stockSummary, fifoLots, stockCheck, fifoHistory } from "../services/stock.service.js";

const router = Router();

router.get("/summary", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });
    res.json(await stockSummary(companyId));
  } catch (e) {
    next(e);
  }
});

router.get("/lots", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const q = z.object({
      product_id: z.coerce.number().int().positive(),
      warehouse_id: z.coerce.number().int().positive()
    }).parse(req.query);

    res.json(await fifoLots(companyId, q.product_id, q.warehouse_id));
  } catch (e) {
    next(e);
  }
});

router.get("/check", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const q = z.object({
      product_id: z.coerce.number().int().positive(),
      warehouse_id: z.coerce.number().int().positive()
    }).parse(req.query);

    res.json(await stockCheck(companyId, q.product_id, q.warehouse_id));
  } catch (e) {
    next(e);
  }
});

router.get("/fifo-history", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const q = z.object({
      product_id: z.coerce.number().int().positive(),
      type: z.enum(['GLOBAL', 'WAREHOUSE']),
      warehouse_id: z.coerce.number().int().positive().optional()
    }).parse(req.query);

    if (q.type === 'WAREHOUSE' && !q.warehouse_id) {
       return res.status(400).json({ message: "warehouse_id required for WAREHOUSE type" });
    }

    res.json(await fifoHistory(companyId, q.product_id, q.type, q.warehouse_id));
  } catch (e) {
    next(e);
  }
});

export default router;
