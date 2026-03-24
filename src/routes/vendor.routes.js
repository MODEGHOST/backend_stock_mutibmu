// vendor.routes.js
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  setVendorActive,
} from "../services/vendor.service.js";

const router = Router();

const ContactSchema = z.object({
  label: z.string().max(100).nullable().optional(),
  channel: z.enum(["phone", "email", "website", "fax", "line", "facebook", "other"]),
  value: z.string().min(1).max(191),
  is_primary: z.coerce.number().int().optional(),
  sort_order: z.coerce.number().int().optional(),
});

const BankSchema = z.object({
  bank_code: z.string().max(20).nullable().optional(),
  bank_name: z.string().min(1).max(100),
  account_name: z.string().min(1).max(150),
  account_no: z.string().min(1).max(50),
  branch_code: z.string().max(20).nullable().optional(),
  is_default: z.coerce.number().int().optional(),
  sort_order: z.coerce.number().int().optional(),
});

const PersonSchema = z.object({
  prefix: z.string().max(20).nullable().optional(),
  first_name: z.string().min(1).max(70),
  last_name: z.string().max(70).nullable().optional(),
  nickname: z.string().max(50).nullable().optional(),
  email: z.string().max(191).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  position: z.string().max(80).nullable().optional(),
  department: z.string().max(80).nullable().optional(),
  is_primary: z.coerce.number().int().optional(),
  sort_order: z.coerce.number().int().optional(),
});

const AddressSchema = z.object({
  contact_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address_line: z.string().max(2000).nullable().optional(),
  subdistrict: z.string().max(100).nullable().optional(),
  district: z.string().max(100).nullable().optional(),
  province: z.string().max(100).nullable().optional(),
  postcode: z.string().max(20).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
});

// ✅ รองรับ 3 แบบ:
// - by_days: due_days
// - by_month_day: month_day (1-31)
// - by_date: due_date (YYYY-MM-DD)
const PaymentTermSchema = z
  .object({
    type: z.enum(["by_days", "by_month_day", "by_date"]).default("by_days"),
    due_days: z.coerce.number().int().min(0).max(3650).optional(),
    month_day: z.coerce.number().int().min(1).max(31).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional()
  .superRefine((v, ctx) => {
    if (!v) return;
    if (v.type === "by_days" && (v.due_days === undefined || v.due_days === null)) {
      ctx.addIssue({ code: "custom", message: "payment_term.due_days required when type=by_days" });
    }
    if (v.type === "by_month_day" && (v.month_day === undefined || v.month_day === null)) {
      ctx.addIssue({ code: "custom", message: "payment_term.month_day required when type=by_month_day" });
    }
    if (v.type === "by_date" && !v.due_date) {
      ctx.addIssue({ code: "custom", message: "payment_term.due_date required when type=by_date" });
    }
  });

// ✅ legal_form ตาม requirement (DB เป็น varchar(30) -> เก็บได้เลย)
const LegalFormSchema = z.enum([
  "company_limited",
  "public_company",
  "limited_partnership",
  "foundation",
  "association",
  "joint_venture",
  "other",
  "personal_individual",
  "personal_ordinary_partnership",
  "personal_shop",
  "personal_group",
]);

const bodySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),

  tax_id: z.string().nullable().optional(),
  tax_country: z.enum(["TH", "OTHER"]).nullable().optional(),

  type: z.enum(["VENDOR", "CUSTOMER", "BOTH"]).nullable().optional(),

  office_type: z.enum(["hq", "branch", "unknown"]).nullable().optional(),

  legal_entity_type: z.enum(["corporate", "individual"]).nullable().optional(),
  legal_form: LegalFormSchema.nullable().optional(),

  business_name: z.string().max(255).nullable().optional(),
  person_first_name: z.string().max(100).nullable().optional(),
  person_last_name: z.string().max(100).nullable().optional(),

  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  is_active: z.coerce.number().int().optional(),

  registered_address: AddressSchema.optional(),
  shipping_address: AddressSchema.optional(),
  goods_shipping_address: AddressSchema.optional(),
  contacts: z.array(ContactSchema).max(5).optional(),
  people: z.array(PersonSchema).max(5).optional(),
  bank_accounts: z.array(BankSchema).max(5).optional(),
  payment_term: PaymentTermSchema,
});

router.get("/", auth, requirePermission("master.vendor.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });
    const { q, sortKey, sortOrder, page = 1, limit = 20 } = req.query;
    res.json(await listVendors(companyId, { q, sortKey, sortOrder, page, limit }));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("master.vendor.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });
    res.json(await getVendor(companyId, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("master.vendor.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const body = bodySchema.parse(req.body);

    // ✅ Guard: ต้องมีผู้ติดต่ออย่างน้อย 1 รายการ
    if (!body.people || body.people.length === 0) {
      return res.status(400).json({ message: "people required (at least 1)" });
    }

    const id = await createVendor(companyId, body);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", auth, requirePermission("master.vendor.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const body = bodySchema.parse(req.body);

    // ✅ Guard: ต้องมีผู้ติดต่ออย่างน้อย 1 รายการ
    if (!body.people || body.people.length === 0) {
      return res.status(400).json({ message: "people required (at least 1)" });
    }

    await updateVendor(companyId, Number(req.params.id), body);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/active", auth, requirePermission("master.vendor.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });
    const body = z.object({ is_active: z.coerce.number().int() }).parse(req.body);
    await setVendorActive(companyId, Number(req.params.id), body.is_active);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
