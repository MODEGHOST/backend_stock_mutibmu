import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listWarehouses,
  createWarehouse,
  updateWarehouse,
  setWarehouseActive,
  getWarehouse
} from "../services/warehouse.service.js";

const router = Router();

const bodySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  location: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  sub_district: z.string().nullable().optional(),
  zip_code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_active: z.coerce.number().int().optional()
});

router.get("/", auth, requirePermission("master.warehouse.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });
    res.json(await listWarehouses(companyId));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("master.warehouse.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    res.json(await getWarehouse(companyId, id));
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("master.warehouse.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const body = bodySchema.parse(req.body);
    const id = await createWarehouse(companyId, body);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", auth, requirePermission("master.warehouse.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    const body = bodySchema.parse(req.body);

    await updateWarehouse(companyId, id, body);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/active", auth, requirePermission("master.warehouse.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    const body = z.object({ is_active: z.coerce.number().int() }).parse(req.body);

    await setWarehouseActive(companyId, id, body.is_active);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
