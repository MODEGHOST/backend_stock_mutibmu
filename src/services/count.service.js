import { withTx, pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { generateDocNo } from "./documentNo.service.js";
import { createAdjustment } from "./adjustment.service.js"; // For auto ADJ

// Helper functions
function normalizeStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeDateStr(v) {
  const s = normalizeStr(v);
  if (!s) return null;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s)) throw new HttpError(400, "Invalid date format");
  return s;
}

function ensurePositiveInt(n, name) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0 || Math.floor(x) !== x) {
    throw new HttpError(400, `${name} is invalid`);
  }
  return x;
}

// ---------------------------------------------------------
// Core Count Service
// ---------------------------------------------------------

export async function createCount(companyId, userId, data) {
  return await withTx(async (conn) => {
    const issueDate = normalizeDateStr(data?.issue_date);
    if (!issueDate) throw new HttpError(400, "issue_date is required");

    const warehouseId = ensurePositiveInt(data?.warehouse_id, "warehouse_id");
    const note = normalizeStr(data?.note);

    let docNo = normalizeStr(data?.doc_no);
    if (!docNo) {
      docNo = await generateDocNo(conn, companyId, "SC", issueDate);
    }

    // Insert Header
    const [r] = await conn.query(
      `
      INSERT INTO stock_counts (
        company_id, doc_no, issue_date, status, 
        warehouse_id, note, created_by
      ) VALUES (
        ?, ?, ?, 'DRAFT', 
        ?, ?, ?
      )
      `,
      [companyId, docNo, issueDate, warehouseId, note, userId]
    );
    const countId = r.insertId;

    if (!Array.isArray(data?.items) || data.items.length === 0) {
      throw new HttpError(400, "Items are required");
    }

    for (const it of data.items) {
      const productId = ensurePositiveInt(it?.product_id, "product_id");
      const countedQty = Number(it?.counted_qty);
      if (!Number.isFinite(countedQty) || countedQty < 0) throw new HttpError(400, "counted_qty must be >= 0");

      // Fetch System Qty at this exact moment
      const [[stock]] = await conn.query(
        `SELECT qty FROM product_stock WHERE company_id=? AND warehouse_id=? AND product_id=?`,
        [companyId, warehouseId, productId]
      );
      const systemQty = Number(stock?.qty || 0);

      await conn.query(
        `
        INSERT INTO stock_count_items (count_id, product_id, system_qty, counted_qty)
        VALUES (?, ?, ?, ?)
        `,
        [countId, productId, systemQty, countedQty]
      );
    }

    return { id: countId, doc_no: docNo };
  });
}

export async function listCounts(companyId, opts = {}) {
  const q = (opts.q ?? "").toString().trim();
  const status = (opts.status ?? "").toString().trim().toUpperCase();
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize ?? 20) || 20));
  const offset = (page - 1) * pageSize;
  const needle = `%${q}%`;

  const where = `
    c.company_id = ?
    AND (? = '' OR c.status = ?)
    AND (
      ? = '' OR
      c.doc_no LIKE ? OR
      w.name LIKE ?
    )
  `;
  const params = [companyId, status, status, q, needle, needle];

  const [cntRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM stock_counts c
    JOIN warehouses w ON w.id = c.warehouse_id
    WHERE ${where}
    `,
    params
  );
  const total = Number(cntRows?.[0]?.total ?? 0);

  const [rows] = await pool.query(
    `
    SELECT
      c.*,
      w.name AS warehouse_name
    FROM stock_counts c
    JOIN warehouses w ON w.id = c.warehouse_id
    WHERE ${where}
    ORDER BY c.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  return { rows, total, page, pageSize };
}

export async function getCount(companyId, id) {
  const [h] = await pool.query(
    `
    SELECT 
      c.*,
      w.name AS warehouse_name
    FROM stock_counts c
    JOIN warehouses w ON w.id = c.warehouse_id
    WHERE c.id = ? AND c.company_id = ?
    LIMIT 1
    `,
    [id, companyId]
  );
  if (h.length === 0) throw new HttpError(404, "Stock Count not found");

  const [items] = await pool.query(
    `
    SELECT 
      ci.*,
      p.code AS product_code,
      p.name AS product_name
    FROM stock_count_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.count_id = ?
    `,
    [id]
  );

  return { header: h[0], items };
}

export async function approveCount(companyId, userId, id) {
  // Use a transaction since we might create an ADJ document
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM stock_counts WHERE id=? AND company_id=? LIMIT 1 FOR UPDATE`,
      [id, companyId]
    );
    if (h.length === 0) throw new HttpError(404, "Stock Count not found");
    const sc = h[0];
    if (sc.status !== "DRAFT") throw new HttpError(400, `Cannot approve count in status ${sc.status}`);

    const [items] = await conn.query(
      `SELECT * FROM stock_count_items WHERE count_id=? ORDER BY id ASC`,
      [id]
    );
    if (items.length === 0) throw new HttpError(400, "Stock count has no items");

    // Check for variances
    const adjItems = [];
    for (const it of items) {
      const variance = Number(it.variance_qty);
      if (variance !== 0) {
        adjItems.push({
          product_id: it.product_id,
          direction: variance > 0 ? "IN" : "OUT",
          qty: Math.abs(variance),
          note: `From SC-${sc.doc_no}`
        });
      }
    }

    let adjId = null;
    let adjDocNo = null;

    if (adjItems.length > 0) {
      // Auto-generate ADJ document using the createAdjustment service
      const adjPayload = {
        issue_date: new Date().toISOString().split('T')[0],
        warehouse_id: sc.warehouse_id,
        reason: `Auto Adjust from Stock Count: ${sc.doc_no}`,
        items: adjItems
      };
      
      // Caution: createAdjustment creates its own Tx internally. 
      // Since we're already in a Tx, it's safer to not nest transactions.
      // But typically we should do it or adapt createAdjustment to accept conn.
      // For node.js mysql2 pool, nested transaction doesn't work, so we use `conn` directly.
      // However, createAdjustment uses `withTx`, which fetches a NEW connection if we just call it.
      // To ensure atomicity properly, we should refactor createAdjustment or emulate its logic here.
      // Given the complexity of ADJ, we can temporarily disable the atomic lock between SC and ADJ,
      // or we emulate ADJ logic briefly. 
      // Emulating createAdjustment logic here to preserve Tx safety:
      
      const adjDate = adjPayload.issue_date;
      const adjNo = await generateDocNo(conn, companyId, "ADJ", adjDate);
      
      const [adjR] = await conn.query(
        `
        INSERT INTO stock_adjustments (company_id, doc_no, warehouse_id, status, reason, created_by)
        VALUES (?, ?, ?, 'DRAFT', ?, ?)
        `,
        [companyId, adjNo, sc.warehouse_id, adjPayload.reason, userId]
      );
      adjId = adjR.insertId;
      adjDocNo = adjNo;

      for (const adi of adjItems) {
        // Average cost fallback for 'IN' 
        let unitCost = 0;
        if (adi.direction === 'IN') {
           const [avg] = await conn.query(
             `SELECT 
               SUM(COALESCE(i.unit_cost,0) * i.qty) / SUM(i.qty) as cost
              FROM purchase_bill_items i
              JOIN purchase_bills b ON b.id = i.purchase_bill_id
              WHERE i.product_id = ? AND b.status = 'APPROVED'
             `, [adi.product_id]
           );
           unitCost = Number(avg[0]?.cost || 0);
        }

        await conn.query(
          `
          INSERT INTO stock_adjustment_items (adjustment_id, product_id, direction, qty, unit_cost, note)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [adjId, adi.product_id, adi.direction, adi.qty, unitCost, adi.note]
        );
      }
    }

    // Update SC status
    await conn.query(
      `UPDATE stock_counts SET status='APPROVED', approved_by=?, approved_at=NOW(), adjustment_id=? WHERE id=? LIMIT 1`,
      [userId, adjId, id]
    );

    return { ok: true, adjustmentCreated: adjId !== null, adjustmentDocNo: adjDocNo };
  });
}

export async function cancelCount(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM stock_counts WHERE id=? AND company_id=? LIMIT 1 FOR UPDATE`,
      [id, companyId]
    );
    if (h.length === 0) throw new HttpError(404, "Stock Count not found");
    const sc = h[0];
    
    if (sc.status === "APPROVED") {
       throw new HttpError(400, "Cannot cancel an APPROVED stock count.");
    }
    if (sc.status === "CANCELLED") {
       throw new HttpError(400, "Count is already cancelled");
    }

    await conn.query(
      `UPDATE stock_counts SET status='CANCELLED', cancelled_by=?, cancelled_at=NOW() WHERE id=? LIMIT 1`,
      [userId, id]
    );

    return { ok: true };
  });
}
