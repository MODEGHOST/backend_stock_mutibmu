import { withTx, pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { fifoConsume } from "./fifo.service.js";

export async function createAdjustment(companyId, userId, data) {
  return await withTx(async (conn) => {
    const [r] = await conn.query(
      `
      INSERT INTO stock_adjustments (company_id, doc_no, warehouse_id, status, reason, created_by)
      VALUES (:company_id, :doc_no, :warehouse_id, 'DRAFT', :reason, :created_by)
      `,
      {
        company_id: companyId,
        doc_no: data.doc_no,
        warehouse_id: data.warehouse_id,
        reason: data.reason ?? null,
        created_by: userId,
      },
    );
    const adjId = r.insertId;

    for (const it of data.items) {
      await conn.query(
        `
        INSERT INTO stock_adjustment_items (adjustment_id, product_id, direction, qty, unit_cost, note)
        VALUES (:adjustment_id, :product_id, :direction, :qty, :unit_cost, :note)
        `,
        {
          adjustment_id: adjId,
          product_id: it.product_id,
          direction: it.direction,
          qty: it.qty,
          unit_cost: it.unit_cost ?? null,
          note: it.note ?? null,
        },
      );
    }

    return adjId;
  });
}

export async function getAdjustment(companyId, id) {
  const [h] = await pool.query(
    `SELECT * FROM stock_adjustments WHERE id=:id AND company_id=:companyId LIMIT 1`,
    { id, companyId },
  );
  if (h.length === 0) throw new HttpError(404, "Not found");

  const [items] = await pool.query(
    `
    SELECT i.id, i.product_id, p.code, p.name, p.unit, i.direction, i.qty, i.unit_cost, i.note
    FROM stock_adjustment_items i
    JOIN products p ON p.id=i.product_id
    WHERE i.adjustment_id=:id
    ORDER BY i.id ASC
    `,
    { id },
  );

  return { header: h[0], items };
}

export async function approveAdjustment(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM stock_adjustments WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const adj = h[0];
    if (adj.status === "CANCELLED") throw new HttpError(400, "Already cancelled");
    if (adj.status !== "DRAFT") throw new HttpError(400, "Invalid status");

    const whId = adj.warehouse_id;

    const [items] = await conn.query(
      `
      SELECT id, product_id, direction, qty, unit_cost, note
      FROM stock_adjustment_items
      WHERE adjustment_id=:id
      ORDER BY id ASC
      FOR UPDATE
      `,
      { id },
    );
    if (items.length === 0) throw new HttpError(400, "No items");

    let cogsTotal = 0;

    for (const it of items) {
      const qty = Number(it.qty);

      if (it.direction === "IN") {
        if (it.unit_cost == null) throw new HttpError(400, "unit_cost required for IN");

        await conn.query(
          `
          INSERT INTO product_stock (product_id, warehouse_id, company_id, qty)
          VALUES (:product_id, :warehouse_id, :company_id, :qty)
          ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)
          `,
          { product_id: it.product_id, warehouse_id: whId, company_id: companyId, qty },
        );

        await conn.query(
          `
          INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
          VALUES (:company_id, 'ADJ_IN', :ref_id, :product_id, :warehouse_id, 'IN', :qty, :note, :created_by)
          `,
          {
            company_id: companyId,
            ref_id: id,
            product_id: it.product_id,
            warehouse_id: whId,
            qty,
            note: it.note ?? adj.reason ?? null,
            created_by: userId,
          },
        );

        const [lotIns] = await conn.query(
          `
          INSERT INTO stock_lots (company_id, product_id, warehouse_id, ref_type, ref_id, received_date, unit_cost, qty_in, qty_out)
          VALUES (:company_id, :product_id, :warehouse_id, 'ADJ_IN', :ref_id, CURDATE(), :unit_cost, :qty_in, 0)
          `,
          {
            company_id: companyId,
            product_id: it.product_id,
            warehouse_id: whId,
            ref_id: id,
            unit_cost: it.unit_cost,
            qty_in: qty,
          },
        );

        const lotId = lotIns.insertId;

        await conn.query(
          `
          INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
          VALUES (:company_id, :lot_id, 'ADJ_IN', :ref_id, :qty, :unit_cost)
          `,
          { company_id: companyId, lot_id: lotId, ref_id: id, qty, unit_cost: it.unit_cost },
        );
      }

      if (it.direction === "OUT") {
        const [ps] = await conn.query(
          `SELECT qty FROM product_stock WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId LIMIT 1 FOR UPDATE`,
          { companyId, productId: it.product_id, warehouseId: whId },
        );
        const currentQty = ps.length ? Number(ps[0].qty) : 0;
        if (currentQty < qty) throw new HttpError(400, "Insufficient stock");

        const { cogs } = await fifoConsume(conn, companyId, it.product_id, whId, qty, "ADJ_OUT", id);
        cogsTotal += cogs;

        await conn.query(
          `
          UPDATE product_stock
          SET qty = qty - :qty
          WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
          `,
          { qty, companyId, productId: it.product_id, warehouseId: whId },
        );

        await conn.query(
          `
          INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
          VALUES (:company_id, 'ADJ_OUT', :ref_id, :product_id, :warehouse_id, 'OUT', :qty, :note, :created_by)
          `,
          {
            company_id: companyId,
            ref_id: id,
            product_id: it.product_id,
            warehouse_id: whId,
            qty,
            note: it.note ?? adj.reason ?? null,
            created_by: userId,
          },
        );
      }
    }

    await conn.query(
      `
      UPDATE stock_adjustments
      SET status='APPROVED',
          cogs_total=:cogs_total,
          approved_by=:approved_by,
          approved_at=NOW()
      WHERE id=:id
      `,
      { cogs_total: cogsTotal, approved_by: userId, id },
    );

    return { ok: true, cogs_total: cogsTotal };
  });
}

export async function cancelAdjustment(companyId, userId, id, reason) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM stock_adjustments WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const adj = h[0];

    if (adj.status === "CANCELLED") throw new HttpError(400, "Already cancelled");

    if (adj.status === "DRAFT") {
      await conn.query(
        `
        UPDATE stock_adjustments
        SET status='CANCELLED',
            cancelled_by=:userId,
            cancelled_at=NOW(),
            cancel_stage='DRAFT',
            cancel_reason=:reason
        WHERE id=:id AND company_id=:companyId
        `,
        { id, companyId, userId, reason },
      );
      return { ok: true, stage: "DRAFT" };
    }

    if (adj.status !== "APPROVED") throw new HttpError(400, "Invalid status");

    const whId = adj.warehouse_id;

    const [items] = await conn.query(
      `
      SELECT id, product_id, direction, qty, unit_cost, note
      FROM stock_adjustment_items
      WHERE adjustment_id=:id
      ORDER BY id ASC
      FOR UPDATE
      `,
      { id },
    );

    for (const it of items) {
      const qty = Number(it.qty);

      if (it.direction === "IN") {
        const [lots] = await conn.query(
          `
          SELECT id AS lot_id, product_id, warehouse_id, qty_in, qty_out, unit_cost
          FROM stock_lots
          WHERE company_id=:companyId AND ref_type='ADJ_IN' AND ref_id=:refId AND product_id=:productId AND warehouse_id=:warehouseId
          ORDER BY id ASC
          FOR UPDATE
          `,
          { companyId, refId: id, productId: it.product_id, warehouseId: whId },
        );
        if (lots.length === 0) throw new HttpError(500, "Missing lots for ADJ_IN");

        let totalIn = 0;
        for (const lot of lots) {
          if (Number(lot.qty_out) > 0) throw new HttpError(400, "Cannot cancel: ADJ_IN lot already consumed");
          totalIn += Number(lot.qty_in);
        }

        await conn.query(
          `
          UPDATE product_stock
          SET qty = qty - :qty
          WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
          `,
          { qty: totalIn, companyId, productId: it.product_id, warehouseId: whId },
        );

        for (const lot of lots) {
          await conn.query(
            `
            UPDATE stock_lots
            SET qty_out = qty_in
            WHERE id=:lotId AND company_id=:companyId
            `,
            { lotId: lot.lot_id, companyId },
          );

          await conn.query(
            `
            INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
            VALUES (:company_id, :lot_id, 'ADJ_IN_CANCEL', :ref_id, :qty, :unit_cost)
            `,
            {
              company_id: companyId,
              lot_id: lot.lot_id,
              ref_id: id,
              qty: Number(lot.qty_in),
              unit_cost: lot.unit_cost,
            },
          );

          await conn.query(
            `
            INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
            VALUES (:company_id, 'ADJ_IN_CANCEL', :ref_id, :product_id, :warehouse_id, 'OUT', :qty, :note, :created_by)
            `,
            {
              company_id: companyId,
              ref_id: id,
              product_id: it.product_id,
              warehouse_id: whId,
              qty: Number(lot.qty_in),
              note: reason,
              created_by: userId,
            },
          );
        }
      }

      if (it.direction === "OUT") {
        const [moves] = await conn.query(
          `
          SELECT m.lot_id, l.product_id, l.warehouse_id, m.qty, m.unit_cost
          FROM stock_lot_moves m
          JOIN stock_lots l ON l.id=m.lot_id
          WHERE m.company_id=:companyId AND m.ref_type='ADJ_OUT' AND m.ref_id=:refId AND l.product_id=:productId AND l.warehouse_id=:warehouseId
          ORDER BY m.id DESC
          FOR UPDATE
          `,
          { companyId, refId: id, productId: it.product_id, warehouseId: whId },
        );
        if (moves.length === 0) throw new HttpError(500, "Missing FIFO moves for ADJ_OUT");

        for (const mv of moves) {
          const q = Number(mv.qty);

          await conn.query(
            `
            UPDATE stock_lots
            SET qty_out = qty_out - :qty
            WHERE id=:lotId AND company_id=:companyId
            `,
            { qty: q, lotId: mv.lot_id, companyId },
          );

          await conn.query(
            `
            UPDATE product_stock
            SET qty = qty + :qty
            WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
            `,
            { qty: q, companyId, productId: mv.product_id, warehouseId: mv.warehouse_id },
          );

          await conn.query(
            `
            INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
            VALUES (:company_id, 'ADJ_OUT_CANCEL', :ref_id, :product_id, :warehouse_id, 'IN', :qty, :note, :created_by)
            `,
            {
              company_id: companyId,
              ref_id: id,
              product_id: mv.product_id,
              warehouse_id: mv.warehouse_id,
              qty: q,
              note: reason,
              created_by: userId,
            },
          );
        }
      }
    }

    await conn.query(
      `
      UPDATE stock_adjustments
      SET status='CANCELLED',
          cancelled_by=:userId,
          cancelled_at=NOW(),
          cancel_stage='APPROVED',
          cancel_reason=:reason
      WHERE id=:id AND company_id=:companyId
      `,
      { id, companyId, userId, reason },
    );

    return { ok: true, stage: "APPROVED" };
  });
}

export async function listAdjustments(companyId, opts = {}) {
  let where = "a.company_id=?";
  const params = [companyId];

  if (opts.status) {
    where += " AND a.status=?";
    params.push(opts.status);
  }

  const sql = `
    SELECT
      a.id, a.doc_no, a.warehouse_id, w.name AS warehouse_name,
      a.status, a.reason,
      a.created_at AS issue_date,
      u.username AS created_by_name,
      a.created_by
    FROM stock_adjustments a
    LEFT JOIN warehouses w ON w.id = a.warehouse_id
    LEFT JOIN users u ON u.id = a.created_by
    WHERE ${where}
    ORDER BY a.id DESC
    LIMIT 200
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}
