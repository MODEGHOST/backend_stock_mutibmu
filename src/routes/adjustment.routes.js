import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createAdjustment,
  getAdjustment,
  approveAdjustment,
  cancelAdjustment,
  listAdjustments,
} from "../services/adjustment.service.js";

const router = Router();

router.get("/", auth, requirePermission("stock.adjust.manage"), async (req, res, next) => {
  try {
    const list = await listAdjustments(req.user.company_id, req.query);
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("stock.adjust.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const body = z.object({
      doc_no: z.string().min(1),
      warehouse_id: z.number().int().positive(),
      reason: z.string().nullable().optional(),
      items: z.array(
        z.object({
          product_id: z.number().int().positive(),
          direction: z.enum(["IN", "OUT"]),
          qty: z.number().int().positive(),
          unit_cost: z.number().nonnegative().nullable().optional(),
          note: z.string().nullable().optional(),
        })
      ).min(1),
    }).parse(req.body);

    for (const it of body.items) {
      if (it.direction === "IN" && (it.unit_cost == null)) {
        return res.status(400).json({ message: "unit_cost required for IN" });
      }
    }

    const id = await createAdjustment(companyId, req.user.sub, body);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("stock.adjust.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    res.json(await getAdjustment(companyId, id));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/approve", auth, requirePermission("stock.adjust.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    res.json(await approveAdjustment(companyId, req.user.sub, id));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", auth, requirePermission("stock.adjust.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    const body = z.object({ reason: z.string().min(5).max(255) }).parse(req.body);

    res.json(await cancelAdjustment(companyId, req.user.sub, id, body.reason));
  } catch (e) {
    next(e);
  }
});

export default router;
