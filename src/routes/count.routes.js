import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createCount,
  listCounts,
  getCount,
  approveCount,
  cancelCount,
} from "../services/count.service.js";

const router = Router();

router.get("/", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await listCounts(companyId, req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await getCount(companyId, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await createCount(companyId, req.user.sub, req.body));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/approve", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await approveCount(companyId, req.user.sub, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await cancelCount(companyId, req.user.sub, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
