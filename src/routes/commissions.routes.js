import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { 
  getUnpaidCommissionsSummary, 
  payCommission, 
  getCommissionPaymentHistory, 
  getUnpaidCommissionInvoices,
  getCommissionPaymentItems
} from "../services/commissions.service.js";

const router = Router();

// GET /commissions/unpaid-summary (Admin Only)
router.get("/unpaid-summary", auth, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "No company_id" });

    const q = z
      .object({
        from: z.string().min(10), // YYYY-MM-DD
        to: z.string().min(10),   // YYYY-MM-DD
      })
      .parse(req.query);

    res.json(await getUnpaidCommissionsSummary(companyId, q.from, q.to));
  } catch (e) {
    next(e);
  }
});

// GET /commissions/unpaid-invoices (Admin Only)
router.get("/unpaid-invoices", auth, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "No company_id" });

    const q = z
      .object({
        seller_id: z.coerce.number().int().positive(),
        from: z.string().min(10),
        to: z.string().min(10),
      })
      .parse(req.query);

    res.json(await getUnpaidCommissionInvoices(companyId, q.seller_id, q.from, q.to));
  } catch (e) {
    next(e);
  }
});

// POST /commissions/pay (Admin Only)
router.post("/pay", auth, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "No company_id" });

    const body = z
      .object({
        seller_id: z.number().int().positive(),
        from: z.string().min(10).optional(),
        to: z.string().min(10).optional(),
        invoice_ids: z.array(z.number().int().positive()).optional(),
        finance_account_id: z.number().int().positive(),
        amount: z.number().min(0).optional(), 
        note: z.string().optional(),
        items: z.array(z.object({
          sale_id: z.number().int().positive(),
          original_amount: z.number().min(0),
          paid_amount: z.number().min(0)
        })).optional(),
      })
      .refine(data => (data.from && data.to) || (data.invoice_ids && data.invoice_ids.length > 0), {
        message: "ต้องระบุช่วงเวลา (from, to) หรือเลือกบิลที่ต้องการจ่าย (invoice_ids)",
      })
      .parse(req.body);

    res.json(await payCommission(companyId, req.user.sub, body));
  } catch (e) {
    next(e);
  }
});

// GET /commissions/history (Admin Only)
router.get("/history", auth, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "No company_id" });

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    res.json(await getCommissionPaymentHistory(companyId, limit, offset));
  } catch (e) {
    next(e);
  }
});

// GET /commissions/history/:id/items (Admin Only)
router.get("/history/:id/items", auth, async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "No company_id" });

    const paymentId = parseInt(req.params.id, 10);
    res.json(await getCommissionPaymentItems(companyId, paymentId));
  } catch (e) {
    next(e);
  }
});

export default router;
