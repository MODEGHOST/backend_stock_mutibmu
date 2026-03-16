// src/routes/billing-note.routes.js
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createBillingNote,
  listBillingNotes,
  getBillingNote,
  cancelBillingNote,
  payBillingNote,
} from "../services/billing-note.service.js";

const router = Router();

// Validation
const CreateBillingNoteSchema = z.object({
  customer_id: z.number().int().positive(),
  issue_date: z.string().min(8), // YYYY-MM-DD
  due_date: z.string().min(8).nullable().optional(),
  note: z.string().nullable().optional(),
  sales_ids: z.array(z.number().int().positive()).min(1), // array of IV IDs
});

router.post(
  "/",
  auth,
  requirePermission("sales.inv.manage"), // Re-using sales permission for billing notes
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const body = CreateBillingNoteSchema.parse(req.body);
      res.json(await createBillingNote(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const q = String(req.query.q || "").trim();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const offset = (page - 1) * limit;

      const resData = await listBillingNotes(companyId, { q, limit, offset });
      res.json(resData);
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/:id",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await getBillingNote(companyId, id));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/cancel",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await cancelBillingNote(companyId, req.user.sub, id));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/:id/pay",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      const amount = Number(req.body.amount || 0);

      if (amount <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }

      res.json(await payBillingNote(companyId, req.user.sub, id, amount));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
