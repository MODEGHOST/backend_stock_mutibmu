import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool, withTx } from "../config/db.js";

const router = Router();

router.post("/companies", auth, requirePermission("master.company.manage"), async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      tax_id: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional()
    }).parse(req.body);

    const id = await withTx(async (conn) => {
      const [r] = await conn.query(
        `
        INSERT INTO companies (name, tax_id, address, phone, email, is_active)
        VALUES (:name, :tax_id, :address, :phone, :email, 1)
        `,
        {
          name: body.name,
          tax_id: body.tax_id ?? null,
          address: body.address ?? null,
          phone: body.phone ?? null,
          email: body.email ?? null
        }
      );
      const newCompanyId = r.insertId;

      // Auto-seed default roles for this new company by cloning from global templates
      const [globalRoles] = await conn.query(`SELECT * FROM roles WHERE company_id IS NULL AND code != 'system_owner'`);
      for (const gRole of globalRoles) {
        const [ins] = await conn.query(
          `INSERT INTO roles (company_id, code, name, is_system, is_active, created_at) VALUES (?, ?, ?, 0, 1, NOW())`,
          [newCompanyId, gRole.code, gRole.name]
        );
        const localRoleId = ins.insertId;

        const [perms] = await conn.query(`SELECT permission_id FROM role_permissions WHERE role_id = ?`, [gRole.id]);
        for (const p of perms) {
          await conn.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW())`, 
            [localRoleId, p.permission_id]
          );
        }
      }
      return newCompanyId;
    });

    res.json({ id });
  } catch (e) {
    next(e);
  }
});

router.get("/companies", auth, requirePermission("master.company.manage"), async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM companies ORDER BY id DESC`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
