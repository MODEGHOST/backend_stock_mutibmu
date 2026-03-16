import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  createTransfer,
  listTransfers,
  getTransfer,
  approveTransfer,
  cancelTransfer,
} from "../services/transfer.service.js";

const router = Router();

router.get("/", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await listTransfers(companyId, req.query));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await getTransfer(companyId, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await createTransfer(companyId, req.user.sub, req.body));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/approve", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await approveTransfer(companyId, req.user.sub, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", auth, requirePermission("stock.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await cancelTransfer(companyId, req.user.sub, Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

export default router;
