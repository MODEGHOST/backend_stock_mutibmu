import { withTx, pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { generateDocNo } from "./documentNo.service.js";
import { addLotTransferMoves } from "./fifo.service.js"; // We will build this next

// Helper functions (borrowed from other services)
function normalizeStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeRequiredStr(v, name = "value") {
  const s = normalizeStr(v);
  if (!s) throw new HttpError(400, `${name} is required`);
  return s;
}

function normalizeDateStr(v) {
  const s = normalizeStr(v);
  if (!s) return null;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(s)) throw new HttpError(400, "Invalid date format (YYYY-MM-DD required)");
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
// Core Transfer Service
// ---------------------------------------------------------

export async function createTransfer(companyId, userId, data) {
  return await withTx(async (conn) => {
    const issueDate = normalizeDateStr(data?.issue_date);
    if (!issueDate) throw new HttpError(400, "issue_date is required");

    const sourceWarehouseId = ensurePositiveInt(data?.source_warehouse_id, "source_warehouse_id");
    const targetWarehouseId = ensurePositiveInt(data?.target_warehouse_id, "target_warehouse_id");
    
    if (sourceWarehouseId === targetWarehouseId) {
      throw new HttpError(400, "Source and Target warehouses cannot be the same");
    }

    const note = normalizeStr(data?.note);

    let docNo = normalizeStr(data?.doc_no);
    if (!docNo) {
      docNo = await generateDocNo(conn, companyId, "TF", issueDate);
    }

    // Insert Header
    const [r] = await conn.query(
      `
      INSERT INTO stock_transfers (
        company_id, doc_no, issue_date, status, 
        source_warehouse_id, target_warehouse_id, note, created_by
      ) VALUES (
        ?, ?, ?, 'DRAFT', 
        ?, ?, ?, ?
      )
      `,
      [companyId, docNo, issueDate, sourceWarehouseId, targetWarehouseId, note, userId]
    );
    const transferId = r.insertId;

    // Validate Items
    if (!Array.isArray(data?.items) || data.items.length === 0) {
      throw new HttpError(400, "Transfer items are required");
    }

    for (const it of data.items) {
      const productId = ensurePositiveInt(it?.product_id, "product_id");
      const qty = Number(it?.qty);
      if (!Number.isFinite(qty) || qty <= 0) throw new HttpError(400, "qty must be > 0");

      await conn.query(
        `
        INSERT INTO stock_transfer_items (transfer_id, product_id, qty)
        VALUES (?, ?, ?)
        `,
        [transferId, productId, qty]
      );
    }

    return { id: transferId, doc_no: docNo };
  });
}

export async function listTransfers(companyId, opts = {}) {
  const q = (opts.q ?? "").toString().trim();
  const status = (opts.status ?? "").toString().trim().toUpperCase();
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(opts.pageSize ?? 20) || 20));
  const offset = (page - 1) * pageSize;
  const needle = `%${q}%`;

  const where = `
    t.company_id = ?
    AND (? = '' OR t.status = ?)
    AND (
      ? = '' OR
      t.doc_no LIKE ? OR
      ws.name LIKE ? OR
      wt.name LIKE ?
    )
  `;
  const params = [companyId, status, status, q, needle, needle, needle];

  const [cntRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM stock_transfers t
    JOIN warehouses ws ON ws.id = t.source_warehouse_id
    JOIN warehouses wt ON wt.id = t.target_warehouse_id
    WHERE ${where}
    `,
    params
  );
  const total = Number(cntRows?.[0]?.total ?? 0);

  const [rows] = await pool.query(
    `
    SELECT
      t.*,
      ws.name AS source_warehouse_name,
      wt.name AS target_warehouse_name
    FROM stock_transfers t
    JOIN warehouses ws ON ws.id = t.source_warehouse_id
    JOIN warehouses wt ON wt.id = t.target_warehouse_id
    WHERE ${where}
    ORDER BY t.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, pageSize, offset]
  );

  return { rows, total, page, pageSize };
}

export async function getTransfer(companyId, id) {
  const [h] = await pool.query(
    `
    SELECT 
      t.*,
      ws.name AS source_warehouse_name,
      wt.name AS target_warehouse_name
    FROM stock_transfers t
    JOIN warehouses ws ON ws.id = t.source_warehouse_id
    JOIN warehouses wt ON wt.id = t.target_warehouse_id
    WHERE t.id = ? AND t.company_id = ?
    LIMIT 1
    `,
    [id, companyId]
  );
  if (h.length === 0) throw new HttpError(404, "Stock Transfer not found");

  const [items] = await pool.query(
    `
    SELECT 
      ti.*,
      p.code AS product_code,
      p.name AS product_name
    FROM stock_transfer_items ti
    JOIN products p ON p.id = ti.product_id
    WHERE ti.transfer_id = ?
    `,
    [id]
  );

  return { header: h[0], items };
}

export async function approveTransfer(companyId, userId, id) {
  return await withTx(async (conn) => {
    // 1. Get header
    const [h] = await conn.query(
      `SELECT * FROM stock_transfers WHERE id=? AND company_id=? LIMIT 1 FOR UPDATE`,
      [id, companyId]
    );
    if (h.length === 0) throw new HttpError(404, "Stock Transfer not found");
    const tf = h[0];
    if (tf.status !== "DRAFT") throw new HttpError(400, `Cannot approve transfer in status ${tf.status}`);

    // 2. Get active items
    const [items] = await conn.query(
      `SELECT * FROM stock_transfer_items WHERE transfer_id=? ORDER BY id ASC`,
      [id]
    );
    if (items.length === 0) throw new HttpError(400, "Transfer has no items");

    // 3. FIFO Deduct from Source & Insert into Target
    for (const it of items) {
      // 3.1 Check available stock in SOURCE
      const [[stock]] = await conn.query(
        `SELECT qty FROM product_stock WHERE company_id=? AND warehouse_id=? AND product_id=? LIMIT 1 FOR UPDATE`,
        [companyId, tf.source_warehouse_id, it.product_id]
      );
      const available = Number(stock?.qty || 0);
      if (available < it.qty) {
        throw new HttpError(400, `Insufficient stock for product ID ${it.product_id} in source warehouse`);
      }

      // 3.2 Add lot transfer strategy via FIFO logic
      await addLotTransferMoves(conn, {
        companyId,
        refType: "TF",
        refId: id,
        sourceWarehouseId: tf.source_warehouse_id,
        targetWarehouseId: tf.target_warehouse_id,
        productId: it.product_id,
        qty: it.qty,
        userId
      });
    }

    // 4. Update status
    await conn.query(
      `UPDATE stock_transfers SET status='APPROVED', approved_by=?, approved_at=NOW() WHERE id=? LIMIT 1`,
      [userId, id]
    );

    return { ok: true };
  });
}

export async function cancelTransfer(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM stock_transfers WHERE id=? AND company_id=? LIMIT 1 FOR UPDATE`,
      [id, companyId]
    );
    if (h.length === 0) throw new HttpError(404, "Stock Transfer not found");
    const tf = h[0];
    
    if (tf.status === "APPROVED") {
       throw new HttpError(400, "Cannot cancel an APPROVED stock transfer. Please make an adjustment (ADJ) instead.");
    }
    if (tf.status === "CANCELLED") {
       throw new HttpError(400, "Transfer is already cancelled");
    }

    await conn.query(
      `UPDATE stock_transfers SET status='CANCELLED', cancelled_by=?, cancelled_at=NOW() WHERE id=? LIMIT 1`,
      [userId, id]
    );

    return { ok: true };
  });
}
