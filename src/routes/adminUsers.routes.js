import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  listCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  setUserRoles,
  resetUserPassword,
} from "../services/adminUsers.service.js";

const router = Router();

router.get(
  "/users",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const q = String(req.query.q || "").trim();
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const offset = (page - 1) * limit;

      res.json(await listCompanyUsers(companyId, { q, limit, offset }));
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  "/users",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const body = z.object({
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(3),
        password: z.string().min(6),
        display_name: z.string().nullable().optional(),
        is_active: z.boolean().optional().default(true),

        // assign roles ตอนสร้าง (optional)
        role_ids: z.array(z.number().int().positive()).optional().default([]),
      }).strict().parse(req.body);

      res.json(await createCompanyUser(companyId, req.user.sub, body));
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  "/users/:id",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);

      const body = z.object({
        first_name: z.string().min(1).optional(),
        last_name: z.string().min(1).optional(),
        phone: z.string().min(3).optional(),
        display_name: z.string().nullable().optional(),
        is_active: z.boolean().optional(),
      }).strict().parse(req.body);

      res.json(await updateCompanyUser(companyId, req.user.sub, id, body));
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/users/:id/roles",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);

      const body = z.object({
        role_ids: z.array(z.number().int().positive()).default([]),
      }).strict().parse(req.body);

      res.json(await setUserRoles(companyId, req.user.sub, id, body.role_ids));
    } catch (e) {
      next(e);
    }
  }
);

router.put(
  "/users/:id/reset-password",
  auth,
  requirePermission("master.user.manage"),
  async (req, res, next) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(400).json({ message: "company_id required" });

      const id = Number(req.params.id);

      const body = z.object({
        password: z.string().min(6),
      }).strict().parse(req.body);

      res.json(await resetUserPassword(companyId, req.user.sub, id, body.password));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
