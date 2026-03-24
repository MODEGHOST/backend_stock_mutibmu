import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as service from "../services/adminRoles.service.js";

const router = Router();

// ==== Roles ====

router.get("/roles", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.sub || req.user.id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    res.json(await service.listCompanyRoles(userId, companyId));
  } catch (e) {
    next(e);
  }
});

router.post("/roles", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const body = z.object({
      code: z.string().optional(),
      name: z.string().min(1)
    }).parse(req.body);

    res.json(await service.createCompanyRole(companyId, body));
  } catch (e) {
    next(e);
  }
});

router.put("/roles/:id", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    const body = z.object({
      name: z.string().min(1)
    }).parse(req.body);

    res.json(await service.updateCompanyRole(companyId, id, body));
  } catch (e) {
    next(e);
  }
});

router.delete("/roles/:id", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    res.json(await service.deleteCompanyRole(companyId, id));
  } catch (e) {
    next(e);
  }
});


// ==== Permissions ====

router.get("/permissions", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    res.json(await service.listAllPermissions());
  } catch (e) {
    next(e);
  }
});

router.get("/roles/:id/permissions", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    res.json(await service.getRolePermissions(companyId, id));
  } catch (e) {
    next(e);
  }
});

router.put("/roles/:id/permissions", auth, requirePermission("master.role.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.sub || req.user.id;
    if (!companyId) return res.status(400).json({ message: "company_id required" });

    const id = Number(req.params.id);
    const body = z.object({
      permission_ids: z.array(z.number())
    }).parse(req.body);

    res.json(await service.setRolePermissions(userId, companyId, id, body.permission_ids));
  } catch (e) {
    next(e);
  }
});

export default router;
