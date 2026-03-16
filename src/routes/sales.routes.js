// sales.routes.js
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createSale,
  getSale,
  confirmSale,
  shipSale,
  approveSale,
  cancelSale,
  listSales,
  collectPayment,
  issueTaxInvoice,
  deductSaleStock,
} from "../services/sales.service.js";

const router = Router();

const CreateSaleSchema = z
  .object({
    customer_id: z.number().int().positive(),
    seller_id: z.number().int().positive().nullable().optional(),
    warehouse_id: z.number().int().positive(),
    issue_date: z.string().min(8),
    valid_until: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    deposit: z.number().nonnegative().optional(),

    // header totals (optional)
    subtotal: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),

    stock_deducted_at: z.enum(["INVOICE", "SHIPMENT"]).optional().default("INVOICE"),
    status: z.string().optional().default("QUOTATION"),

    items: z
      .array(
        z
          .object({
            product_id: z.number().int().positive(),
            quantity: z.number().int().positive(),
            price: z.number().nonnegative(),

            discount_percent: z.number().min(0).max(100).optional().default(0),
            discount_amount: z.number().min(0).optional().default(0),

            vat_mode: z.enum(["EXCL", "INCL", "NONE"]).optional().default("EXCL"),
            vat_rate: z.number().min(0).max(100).optional().default(7),

            commission_mode: z.enum(["PERCENT", "AMOUNT"]).optional().default("PERCENT"),
            commission_value: z.number().min(0).optional().default(0),

            withholding_rate: z.number().min(0).max(100).optional().default(0),

            total: z.number().min(0).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

router.get(
  "/invoice",
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

      const status = req.query.status ? String(req.query.status) : undefined;
      const has_receipt = req.query.has_receipt === 'true' ? true : undefined;
      const has_invoice = req.query.has_invoice === 'true' ? true : undefined;
      const sortKey = req.query.sortKey ? String(req.query.sortKey) : undefined;
      const sortOrder = req.query.sortOrder ? String(req.query.sortOrder) : undefined;

      res.json(await listSales(companyId, { q, limit, offset, status, has_receipt, has_invoice, sortKey, sortOrder }));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const body = CreateSaleSchema.parse(req.body);
      res.json(await createSale(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/invoice/:id",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await getSale(companyId, id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/confirm",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      const stockDeductedAt = req.body.stock_deducted_at || "INVOICE";
      const issueTax = req.body.issue_tax === true;
      res.json(await confirmSale(companyId, req.user.sub, id, stockDeductedAt, issueTax));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/ship",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      const issueTax = req.body.issue_tax === true;
      res.json(await shipSale(companyId, req.user.sub, id, issueTax));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/deduct-stock",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await deductSaleStock(companyId, req.user.sub, id));
    } catch (e) {
      next(e);
    }
  },
);

// ✅ approve แยกจริง ไม่เรียก ship ซ้ำ
router.post(
  "/invoice/:id/approve",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await approveSale(companyId, req.user.sub, id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/payment",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      
      const body = z.object({
        issue_tax: z.boolean().optional(),
        finance_account_id: z.number().int().positive().nullable().optional()
      }).parse(req.body);

      res.json(await collectPayment(companyId, req.user.sub, id, body));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/tax-invoice",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);
      res.json(await issueTaxInvoice(companyId, req.user.sub, id));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/invoice/:id/cancel",
  auth,
  requirePermission("sales.inv.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);

      const body = z
        .object({
          reason: z.string().min(5).max(255),
        })
        .strict()
        .parse(req.body);

      res.json(await cancelSale(companyId, req.user.sub, id, body.reason));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
