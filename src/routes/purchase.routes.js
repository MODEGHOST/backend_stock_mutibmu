// purchase.routes.js
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createGrn,
  getGrn,
  approveGrn,
  cancelGrn,
  listGrn,
  createPo,
  getPo,
  approvePo,
  cancelPo,
  listPo,
  createBill,
  getBill,
  approveBill,
  cancelBill,
  listBill,
  setBillPaid,
} from "../services/purchase.service.js";

const router = Router();

// -------------------- Helpers --------------------
const DocNoOptional = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "undefined") return undefined;
  return s;
}, z.string().min(1).optional());

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TaxTypeEnum = z.enum(["EXCLUDE_VAT_7", "INCLUDE_VAT_7", "NO_VAT"]);
const HeaderDiscountTypeEnum = z.enum(["PERCENT", "AMOUNT"]);

// ใช้ร่วมกับ PO/BILL (มีส่วนลด/ภาษี)
const ItemsSchema = z
  .array(
    z.object({
      product_id: z.number().int().positive(),
      qty: z.number().positive(),
      unit_cost: z.number().nonnegative().optional().default(0),
      discount_pct: z.number().min(0).max(100).optional().default(0),
      discount_amt: z.number().nonnegative().optional().default(0),
      tax_type: TaxTypeEnum.optional().default("EXCLUDE_VAT_7"),
      manual_vat: z.number().nonnegative().nullable().optional(),
    }),
  )
  .min(1);

// GRN item: เพิ่ม bill_item_id เพื่อผูกกับ BILL item (สำคัญสำหรับ partial receive) + financial fields
const GrnItemsSchema = z
  .array(
    z.object({
      bill_item_id: z.number().int().positive().nullable().optional(),
      product_id: z.number().int().positive(),
      qty: z.number().positive(),
      unit_cost: z.number().nonnegative().optional().default(0),
      discount_pct: z.number().min(0).max(100).optional().default(0),
      discount_amt: z.number().nonnegative().optional().default(0),
      tax_type: TaxTypeEnum.optional().default("EXCLUDE_VAT_7"),
      manual_vat: z.number().nonnegative().nullable().optional(),
    }),
  )
  .min(1);

// ===================== BILL =====================
router.post(
  "/bill",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({
          bill_no: z.string().min(1),
          tax_invoice_no: z.string().min(1),
          po_id: z.number().int().positive().nullable().optional(),
          vendor_id: z.number().int().positive(),
          vendor_person_id: z.number().int().positive().nullable().optional(),
          warehouse_id: z.number().int().positive(),
          issue_date: DateStr,
          paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          finance_account_id: z.number().int().positive().nullable().optional(),
          note: z.string().nullable().optional(),
          extra_charge_amt: z.number().nonnegative().optional().default(0),
          extra_charge_note: z.string().max(255).nullable().optional(),
          header_discount_type: z
            .enum(["PERCENT", "AMOUNT"])
            .nullable()
            .optional(),
          header_discount_value: z.number().nonnegative().optional().default(0),
          items: ItemsSchema,
        })
        .parse(req.body);

      res.json(await createBill(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bill/:id",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(await getBill(companyId, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bill/:id/approve",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(
        await approveBill(companyId, req.user.sub, Number(req.params.id)),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bill/:id/cancel",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({ reason: z.string().min(5).max(255) })
        .parse(req.body);
      res.json(
        await cancelBill(
          companyId,
          req.user.sub,
          Number(req.params.id),
          body.reason,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/bill",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const q = (req.query.q ?? "").toString().trim();
      const statusRaw = (req.query.status ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const status =
        statusRaw === "DRAFT" ||
        statusRaw === "APPROVED" ||
        statusRaw === "CANCELLED"
          ? statusRaw
          : "";

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSizeRaw = Number(req.query.pageSize ?? 20) || 20;
      const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

      res.json(await listBill(companyId, { q, status, page, pageSize }));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/bill/:id/paid",
  auth,
  requirePermission("purchase.bill.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({
          paid_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable(),
          finance_account_id: z.number().int().positive().nullable().optional(),
        })
        .parse(req.body);

      res.json(
        await setBillPaid(
          companyId,
          req.user.sub,
          Number(req.params.id),
          body.paid_date,
          body.finance_account_id,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

// ===================== GRN =====================
// ✅ รองรับ 2 โหมด
// 1) legacy: GRN ผูก PO/ป้อนเอง
// 2) recommended: GRN ผูก BILL (ส่ง bill_id) + ใส่ bill_item_id เพื่อ partial receive
router.post(
  "/grn",
  auth,
  requirePermission("purchase.grn.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({
          grn_no: DocNoOptional,

          // ✅ NEW
          bill_id: z.number().int().positive().nullable().optional(),

          po_id: z.number().int().positive().nullable().optional(),
          vendor_id: z.number().int().positive().nullable().optional(),
          warehouse_id: z.number().int().positive().nullable().optional(),

          issue_date: DateStr,
          note: z.string().nullable().optional(),

          // Financials
          extra_charge_amt: z.number().nonnegative().optional().default(0),
          extra_charge_note: z.string().max(255).nullable().optional(),
          header_discount_type: HeaderDiscountTypeEnum.nullable().optional(),
          header_discount_value: z.number().nonnegative().optional().default(0),

          // ✅ ถ้าส่ง bill_id แนะนำใช้ bill_item_id ใน items
          items: GrnItemsSchema.optional(),
        })
        .parse(req.body);

      res.json(await createGrn(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/grn/:id",
  auth,
  requirePermission("purchase.grn.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(await getGrn(companyId, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grn/:id/approve",
  auth,
  requirePermission("purchase.grn.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(
        await approveGrn(companyId, req.user.sub, Number(req.params.id)),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grn/:id/cancel",
  auth,
  requirePermission("purchase.grn.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({ reason: z.string().min(5).max(255) })
        .parse(req.body);
      res.json(
        await cancelGrn(
          companyId,
          req.user.sub,
          Number(req.params.id),
          body.reason,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/grn",
  auth,
  requirePermission("purchase.grn.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const q = (req.query.q ?? "").toString().trim();
      const statusRaw = (req.query.status ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const status =
        statusRaw === "DRAFT" ||
        statusRaw === "APPROVED" ||
        statusRaw === "CANCELLED"
          ? statusRaw
          : "";

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSizeRaw = Number(req.query.pageSize ?? 20) || 20;
      const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

      res.json(await listGrn(companyId, { q, status, page, pageSize }));
    } catch (e) {
      next(e);
    }
  },
);

// ===================== PO =====================
router.post(
  "/po",
  auth,
  requirePermission("purchase.po.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({
          po_no: DocNoOptional,
          vendor_id: z.number().int().positive(),
          vendor_person_id: z.number().int().positive().nullable().optional(),
          warehouse_id: z.number().int().positive(),
          issue_date: DateStr,
          expected_date: DateStr.nullable().optional(),
          note: z.string().nullable().optional(),
          extra_charge_amt: z.number().nonnegative().optional().default(0),
          extra_charge_note: z.string().max(255).nullable().optional(),
          header_discount_type: z
            .enum(["PERCENT", "AMOUNT"])
            .nullable()
            .optional(),
          header_discount_value: z.number().nonnegative().optional().default(0),

          items: ItemsSchema,
        })
        .parse(req.body);

      res.json(await createPo(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/po/:id",
  auth,
  requirePermission("purchase.po.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(await getPo(companyId, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/po/:id/approve",
  auth,
  requirePermission("purchase.po.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      res.json(await approvePo(companyId, req.user.sub, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/po/:id/cancel",
  auth,
  requirePermission("purchase.po.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const body = z
        .object({ reason: z.string().min(5).max(255) })
        .parse(req.body);
      res.json(
        await cancelPo(
          companyId,
          req.user.sub,
          Number(req.params.id),
          body.reason,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/po",
  auth,
  requirePermission("purchase.po.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId)
        return res.status(400).json({ message: "company_id required" });

      const q = (req.query.q ?? "").toString().trim();
      const statusRaw = (req.query.status ?? "")
        .toString()
        .trim()
        .toUpperCase();
      const status =
        statusRaw === "DRAFT" ||
        statusRaw === "APPROVED" ||
        statusRaw === "CANCELLED"
          ? statusRaw
          : "";

      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const pageSizeRaw = Number(req.query.pageSize ?? 20) || 20;
      const pageSize = Math.min(100, Math.max(1, pageSizeRaw));

      res.json(await listPo(companyId, { q, status, page, pageSize }));
    } catch (e) {
      next(e);
    }
  },
);

export default router;
