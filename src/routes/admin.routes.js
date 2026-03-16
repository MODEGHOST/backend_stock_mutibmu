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
      return r.insertId;
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
