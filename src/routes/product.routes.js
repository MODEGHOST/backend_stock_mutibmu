import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductActive
} from "../services/product.service.js";

const router = Router();

const productBodySchema = z.object({
  code: z.string().min(1).optional(), // 👈 optional (auto gen)
  name: z.string().min(1),
  unit: z.string().nullable().optional(),
  sell_price: z.coerce.number().nonnegative().optional(),
  is_active: z.coerce.number().int().optional(),
  is_vat: z.coerce.number().int().optional(), // 👈 NEW
});

router.get("/", auth, requirePermission("master.product.manage"), async (req, res, next) => {
  try {
    res.json(await listProducts(req.user.company_id));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("master.product.manage"), async (req, res, next) => {
  try {
    res.json(await getProduct(req.user.company_id, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("master.product.manage"), async (req, res, next) => {
  try {
    const body = productBodySchema.parse(req.body);
    const id = await createProduct(req.user.company_id, body);
    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.put("/:id", auth, requirePermission("master.product.manage"), async (req, res, next) => {
  try {
    const body = productBodySchema.parse(req.body);
    await updateProduct(req.user.company_id, Number(req.params.id), body);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/active", auth, requirePermission("master.product.manage"), async (req, res, next) => {
  try {
    await setProductActive(
      req.user.company_id,
      Number(req.params.id),
      z.object({ is_active: z.coerce.number().int() }).parse(req.body).is_active
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
