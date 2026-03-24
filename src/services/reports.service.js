// src/services/reports.service.js
import { pool } from "../config/db.js";

const SALE_OK = ["CONFIRMED", "SHIPPED"];

// ========== Dashboard Summary Cards ==========
export async function dashboardSummary(companyId, from, to, lowStockThreshold = 10) {
  const [stockAgg] = await pool.query(
    `
    SELECT
      COUNT(DISTINCT ps.product_id) AS sku_count,
      COALESCE(SUM(ps.qty), 0) AS stock_qty
    FROM product_stock ps
    WHERE ps.company_id = ?
    `,
    [companyId],
  );

  const [lowAgg] = await pool.query(
    `
    SELECT COUNT(*) AS low_count
    FROM (
      SELECT ps.product_id, ps.warehouse_id, SUM(ps.qty) AS qty
      FROM product_stock ps
      WHERE ps.company_id = ?
      GROUP BY ps.product_id, ps.warehouse_id
      HAVING SUM(ps.qty) < ?
    ) t
    `,
    [companyId, Number(lowStockThreshold)],
  );

  const [salesAgg] = await pool.query(
    `
    SELECT
      COUNT(*) AS inv_count,
      COALESCE(SUM(s.total), 0) AS sales_total,
      COALESCE(SUM((s.total - COALESCE(s.tax, 0)) - COALESCE(s.cogs_total, 0)), 0) AS profit_total
    FROM sales s
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND s.issue_date BETWEEN ? AND ?
    `,
    [companyId, ...SALE_OK, from, to],
  );

  // pending: นิยามง่ายสุด
  const [pendingConfirmedAgg] = await pool.query(
    `
    SELECT COUNT(*) AS pending_confirmed
    FROM sales s
    WHERE s.company_id = ?
      AND s.status = 'CONFIRMED'
      AND s.issue_date BETWEEN ? AND ?
    `,
    [companyId, from, to],
  );

  const [pendingDraftAgg] = await pool.query(
    `
    SELECT COUNT(*) AS pending_draft
    FROM sales s
    WHERE s.company_id = ?
      AND s.status = 'DRAFT'
      AND s.issue_date BETWEEN ? AND ?
    `,
    [companyId, from, to],
  );

  // Purchase Metrics
  // 1. PO Counts & Total (Calculate total from items)
  // Status: DRAFT, APPROVED, CANCELLED
  const [poAgg] = await pool.query(
    `
    SELECT
      COUNT(CASE WHEN po.status = 'DRAFT' THEN 1 END) as pending_draft,
      COUNT(CASE WHEN po.status = 'APPROVED' THEN 1 END) as pending_confirmed,
      SUM(CASE WHEN po.status = 'APPROVED' THEN
        GREATEST(0,
          (COALESCE(sub.items_total, 0) + COALESCE(po.extra_charge_amt, 0)) -
          CASE
            WHEN po.header_discount_type = 'PERCENT' THEN (COALESCE(sub.items_total, 0) + COALESCE(po.extra_charge_amt, 0)) * (COALESCE(po.header_discount_value, 0) / 100)
            ELSE COALESCE(po.header_discount_value, 0)
          END
        )
      ELSE 0 END) as total_po_amount
    FROM purchase_orders po
    LEFT JOIN (
      SELECT
        purchase_order_id,
        SUM(
          GREATEST(0, (qty * unit_cost) - ((qty * unit_cost) * (discount_pct / 100)) - discount_amt)
        ) AS items_total
      FROM purchase_order_items
      GROUP BY purchase_order_id
    ) sub ON sub.purchase_order_id = po.id
    WHERE po.company_id = ? AND po.issue_date BETWEEN ? AND ?
    `,
    [companyId, from, to],
  );

  // 2. GRN Counts
  const [grnAgg] = await pool.query(
    `
    SELECT
      COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as pending_draft
    FROM goods_receipts
    WHERE company_id = ? AND issue_date BETWEEN ? AND ?
    `,
    [companyId, from, to],
  );

  // 3. Bill Counts & Total
  const [billAgg] = await pool.query(
    `
    SELECT
      COUNT(CASE WHEN b.status = 'DRAFT' THEN 1 END) as pending_draft,
      COUNT(CASE WHEN b.status = 'APPROVED' AND b.paid_date IS NULL THEN 1 END) as unpaid_count,
      SUM(CASE WHEN b.status = 'APPROVED' THEN
        GREATEST(0,
          (COALESCE(sub.items_total, 0) + COALESCE(b.extra_charge_amt, 0)) -
          CASE
            WHEN b.header_discount_type = 'PERCENT' THEN (COALESCE(sub.items_total, 0) + COALESCE(b.extra_charge_amt, 0)) * (COALESCE(b.header_discount_value, 0) / 100)
            ELSE COALESCE(b.header_discount_value, 0)
          END
        )
      ELSE 0 END) as total_bill_amount
    FROM purchase_bills b
    LEFT JOIN (
      SELECT
        purchase_bill_id,
        SUM(
          GREATEST(0, (qty * unit_cost) - ((qty * unit_cost) * (discount_pct / 100)) - discount_amt)
        ) AS items_total
      FROM purchase_bill_items
      GROUP BY purchase_bill_id
    ) sub ON sub.purchase_bill_id = b.id
    WHERE b.company_id = ? AND b.issue_date BETWEEN ? AND ?
    `,
    [companyId, from, to],
  );

  const a = stockAgg?.[0] ?? {};
  const b = lowAgg?.[0] ?? {};
  const c = salesAgg?.[0] ?? {};
  const pc = pendingConfirmedAgg?.[0] ?? {};
  const pd = pendingDraftAgg?.[0] ?? {};

  const po = poAgg?.[0] ?? {};
  const grn = grnAgg?.[0] ?? {};
  const bill = billAgg?.[0] ?? {};

  return {
    cards: {
      skuCount: Number(a.sku_count || 0),
      stockQty: Number(a.stock_qty || 0),
      lowStockCount: Number(b.low_count || 0),
      salesTotal: Number(c.sales_total || 0),
      profitTotal: Number(c.profit_total || 0),
      invoiceCount: Number(c.inv_count || 0),
      pendingConfirmedCount: Number(pc.pending_confirmed || 0),
      pendingDraftCount: Number(pd.pending_draft || 0),

      // Purchase (Updated to focus on Drafts if needed, sending all)
      poDraftCount: Number(po.pending_draft || 0),
      poPendingCount: Number(po.pending_confirmed || 0),
      poTotalAmount: Number(po.total_po_amount || 0),
      grnDraftCount: Number(grn.pending_draft || 0),
      billDraftCount: Number(bill.pending_draft || 0),
      billUnpaidCount: Number(bill.unpaid_count || 0),
      billTotalAmount: Number(bill.total_bill_amount || 0),
    },
  };
}

// ========== Low Stock List ==========
export async function lowStock(companyId, threshold = 10, limit = 50) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id AS product_id,
      p.code AS product_code,
      p.name AS product_name,
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      SUM(ps.qty) AS qty,
      ? AS threshold,
      GREATEST(0, (? - SUM(ps.qty))) AS need
    FROM product_stock ps
    JOIN products p ON p.id = ps.product_id
    JOIN warehouses w ON w.id = ps.warehouse_id
    WHERE ps.company_id = ?
    GROUP BY p.id, w.id
    HAVING SUM(ps.qty) < ?
    ORDER BY need DESC, qty ASC
    LIMIT ?
    `,
    [Number(threshold), Number(threshold), companyId, Number(threshold), Number(limit)],
  );
  return { rows };
}

// ========== Hot Sellers ==========
export async function hotSellers(companyId, from, to, topN = 10) {
  const [rows] = await pool.query(
    `
    SELECT
      si.product_id,
      p.code AS product_code,
      p.name AS product_name,
      COALESCE(SUM(si.quantity),0) AS qty_sold,
      COALESCE(SUM(si.total),0) AS amount
    FROM sales_items si
    JOIN sales s ON s.id = si.sales_id
    JOIN products p ON p.id = si.product_id
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND s.issue_date BETWEEN ? AND ?
    GROUP BY si.product_id
    ORDER BY qty_sold DESC
    LIMIT ?
    `,
    [companyId, ...SALE_OK, from, to, Number(topN)],
  );
  return { rows };
}

// ========== Commission By Seller ==========
export async function commissionBySeller(companyId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      s.seller_id,
      u.email AS seller_email,
      CONCAT(u.first_name, ' ', u.last_name) AS seller_name,
      COUNT(DISTINCT s.id) AS inv_count,
      COALESCE(SUM(si.commission_total), 0) AS commission_total,
      COALESCE(SUM(s.total), 0) AS amount_total
    FROM sales s
    JOIN sales_items si ON si.sales_id = s.id
    LEFT JOIN users u ON u.id = s.seller_id
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND s.issue_date BETWEEN ? AND ?
    GROUP BY s.seller_id
    ORDER BY commission_total DESC
    `,
    [companyId, ...SALE_OK, from, to],
  );
  return { rows };
}

// ========== Sales Trend ==========
export async function salesTrend(companyId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      DATE(s.issue_date) AS date,
      COUNT(*) AS inv_count,
      COALESCE(SUM(s.total),0) AS amount
    FROM sales s
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND s.issue_date BETWEEN ? AND ?
    GROUP BY DATE(s.issue_date)
    ORDER BY DATE(s.issue_date) ASC
    `,
    [companyId, ...SALE_OK, from, to],
  );
  return { rows };
}

// ========== Sales By Seller (Drilldown) ==========
export async function salesBySeller(companyId, date) {
  const [rows] = await pool.query(
    `
    SELECT
      s.seller_id,
      u.email AS seller_email,
      CONCAT(u.first_name, ' ', u.last_name) AS seller_name,
      COUNT(*) AS inv_count,
      COALESCE(SUM(s.total), 0) AS amount_total
    FROM sales s
    LEFT JOIN users u ON u.id = s.seller_id
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND DATE(s.issue_date) = ?
    GROUP BY s.seller_id
    ORDER BY amount_total DESC
    `,
    [companyId, ...SALE_OK, date],
  );

  return { rows };
}


export async function sellerInvoices(companyId, from, to, sellerIdStr) {
  const sellerId = sellerIdStr === "null" ? null : Number(sellerIdStr);

  // condition seller
  const sellerWhere = sellerId === null ? "s.seller_id IS NULL" : "s.seller_id = ?";

  const params = [companyId, ...SALE_OK, from, to];
  if (sellerId !== null) params.push(sellerId);

  const [rows] = await pool.query(
    `
    SELECT
      s.id AS sale_id,
      s.invoice_no,
      s.status,
      s.issue_date,
      s.total,
      COALESCE(SUM(si.commission_total), 0) AS commission_total
    FROM sales s
    JOIN sales_items si ON si.sales_id = s.id
    WHERE s.company_id = ?
      AND s.status IN (${SALE_OK.map(() => "?").join(",")})
      AND s.issue_date BETWEEN ? AND ?
      AND ${sellerWhere}
    GROUP BY s.id
    ORDER BY s.issue_date DESC, s.id DESC
    `,
    params,
  );

  return { rows };
}

// ✅ NEW 2) รายละเอียดใน INV (items)
export async function saleInvoiceDetail(companyId, saleId) {
  // guard: sale ต้องเป็นของ company นี้
  const [hdr] = await pool.query(
    `
    SELECT
      s.id AS sale_id,
      s.invoice_no,
      s.status,
      s.issue_date,
      s.total,
      s.subtotal,
      s.tax,
      s.seller_id,
      u.email AS seller_email,
      CONCAT(u.first_name, ' ', u.last_name) AS seller_name
    FROM sales s
    LEFT JOIN users u ON u.id = s.seller_id
    WHERE s.company_id = ? AND s.id = ?
    LIMIT 1
    `,
    [companyId, saleId],
  );

  if (!hdr?.[0]) {
    return { header: null, rows: [] };
  }

  const [rows] = await pool.query(
    `
    SELECT
      si.id,
      si.sales_id,
      si.product_id,
      p.code AS product_code,
      p.name AS product_name,
      si.quantity,
      si.price,
      si.discount_percent,
      si.discount_amount,
      si.total,
      si.vat_mode,
      si.vat_rate,
      si.vat_amount,
      si.commission_mode,
      si.commission_value,
      si.commission_total
    FROM sales_items si
    LEFT JOIN products p ON p.id = si.product_id
    WHERE si.sales_id = ?
    ORDER BY si.id ASC
    `,
    [saleId],
  );

  return { header: hdr[0], rows };
}

// ========== Top Vendors (by Spending) ==========
export async function topVendors(companyId, from, to, topN = 10) {
  const [rows] = await pool.query(
    `
    SELECT
      po.vendor_id,
      v.code AS vendor_code,
      v.name AS vendor_name,
      COUNT(po.id) AS po_count,
      SUM(
        GREATEST(0,
          (COALESCE(sub.items_total, 0) + COALESCE(po.extra_charge_amt, 0)) -
          CASE
            WHEN po.header_discount_type = 'PERCENT' THEN (COALESCE(sub.items_total, 0) + COALESCE(po.extra_charge_amt, 0)) * (COALESCE(po.header_discount_value, 0) / 100)
            ELSE COALESCE(po.header_discount_value, 0)
          END
        )
      ) AS total_spend
    FROM purchase_orders po
    JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN (
      SELECT
        purchase_order_id,
        SUM(
          GREATEST(0, (qty * unit_cost) - ((qty * unit_cost) * (discount_pct / 100)) - discount_amt)
        ) AS items_total
      FROM purchase_order_items
      GROUP BY purchase_order_id
    ) sub ON sub.purchase_order_id = po.id
    WHERE po.company_id = ?
      AND po.status = 'APPROVED'
      AND po.issue_date BETWEEN ? AND ?
    GROUP BY po.vendor_id, v.code, v.name
    ORDER BY total_spend DESC
    LIMIT ?
    `,
    [companyId, from, to, Number(topN)],
  );

  return {
    rows,
  };
}

export async function exportStock(companyId) {
  // 1. Get Stock Summary
  const [summary] = await pool.query(
    `
    SELECT 
      p.code as product_code,
      p.name as product_name,
      w.name as warehouse_name,
      ps.qty,
      p.unit
    FROM product_stock ps
    JOIN products p ON p.id = ps.product_id
    JOIN warehouses w ON w.id = ps.warehouse_id
    WHERE ps.company_id = ? AND ps.qty != 0
    ORDER BY w.name, p.code
    `,
    [companyId]
  );

  // 2. Get Stock Lots (FIFO)
  const [lots] = await pool.query(
    `
    SELECT 
      l.id as lot_id,
      l.received_date,
      p.code as product_code,
      p.name as product_name,
      w.name as warehouse_name,
      (l.qty_in - l.qty_out) as remaining_qty,
      l.unit_cost,
      ((l.qty_in - l.qty_out) * l.unit_cost) as lot_value
    FROM stock_lots l
    JOIN products p ON p.id = l.product_id
    JOIN warehouses w ON w.id = l.warehouse_id
    WHERE l.company_id = ? AND (l.qty_in - l.qty_out) > 0
    ORDER BY p.code, l.received_date
    `,
    [companyId]
  );

  // 3. Generate Excel
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.default.Workbook();

  // Sheet 1: Summary
  const sheet1 = workbook.addWorksheet("Stock Summary");
  sheet1.columns = [
    { header: "คลังสินค้า", key: "warehouse_name", width: 15 },
    { header: "รหัสสินค้า", key: "product_code", width: 15 },
    { header: "ชื่อสินค้า", key: "product_name", width: 30 },
    { header: "จำนวนคงเหลือ", key: "qty", width: 15 },
    { header: "หน่วย", key: "unit", width: 10 },
  ];
  sheet1.addRows(summary);

  // Sheet 2: Lot Details
  const sheet2 = workbook.addWorksheet("Lot Details (FIFO)");
  sheet2.columns = [
    { header: "รหัสสินค้า", key: "product_code", width: 15 },
    { header: "ชื่อสินค้า", key: "product_name", width: 30 },
    { header: "คลังสินค้า", key: "warehouse_name", width: 15 },
    { header: "วันที่รับของ", key: "received_date", width: 15 },
    { header: "เลขที่ Lot", key: "lot_id", width: 10 },
    { header: "คงเหลือ (ใน Lot)", key: "remaining_qty", width: 15 },
    { header: "ต้นทุนต่อหน่วย", key: "unit_cost", width: 15 },
    { header: "มูลค่าคงเหลือ", key: "lot_value", width: 15 },
  ];
  sheet2.addRows(lots);

  // Return Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// ========== Stock Card ==========
export async function stockCard(companyId, productId, warehouseId, from, to) {
  // Get opening balance before 'from' date
  let sqlOpen = `
    SELECT COALESCE(SUM(qty), 0) AS opening_qty
    FROM stock_moves
    WHERE company_id = ? AND product_id = ? AND created_at < ?
  `;
  const paramsOpen = [companyId, productId, `${from} 00:00:00`];
  if (warehouseId) {
    sqlOpen += ` AND warehouse_id = ?`;
    paramsOpen.push(warehouseId);
  }
  const [[openRow]] = await pool.query(sqlOpen, paramsOpen);
  const openingQty = Number(openRow?.opening_qty || 0);

  // Get movements within range
  let sqlMoves = `
    SELECT
      m.id,
      m.created_at AS date,
      m.ref_type,
      m.ref_id,
      m.move_type,
      m.qty,
      m.note,
      w.name AS warehouse_name
    FROM stock_moves m
    LEFT JOIN warehouses w ON w.id = m.warehouse_id
    WHERE m.company_id = ? AND m.product_id = ? 
      AND m.created_at >= ? AND m.created_at <= ?
  `;
  const paramsMoves = [companyId, productId, `${from} 00:00:00`, `${to} 23:59:59`];
  if (warehouseId) {
     sqlMoves += ` AND m.warehouse_id = ?`;
     paramsMoves.push(warehouseId);
  }
  sqlMoves += ` ORDER BY m.created_at ASC, m.id ASC`;

  const [moves] = await pool.query(sqlMoves, paramsMoves);

  // Calculate Running Balance
  let runningBal = openingQty;
  const rows = moves.map(m => {
     runningBal += Number(m.qty);
     return {
       ...m,
       balance: runningBal
     };
  });

  return { openingQty, rows, closingQty: runningBal };
}

// ========== AR / AP Aging ==========
export async function arApAging(companyId, type = "AR") {
  // AR = ลูกหนี้ (Sales)
  // AP = เจ้าหนี้ (Purchase Bills)
  
  if (type === "AR") {
    const [rows] = await pool.query(
      `
      SELECT 
        v.id AS customer_id,
        v.code AS customer_code,
        v.name AS customer_name,
        SUM(CASE WHEN DATEDIFF(CURDATE(), s.issue_date) <= 30 THEN s.balance_due ELSE 0 END) AS age_0_30,
        SUM(CASE WHEN DATEDIFF(CURDATE(), s.issue_date) BETWEEN 31 AND 60 THEN s.balance_due ELSE 0 END) AS age_31_60,
        SUM(CASE WHEN DATEDIFF(CURDATE(), s.issue_date) BETWEEN 61 AND 90 THEN s.balance_due ELSE 0 END) AS age_61_90,
        SUM(CASE WHEN DATEDIFF(CURDATE(), s.issue_date) > 90 THEN s.balance_due ELSE 0 END) AS age_over_90,
        SUM(s.balance_due) AS total_due
      FROM sales s
      JOIN vendors v ON v.id = s.customer_id
      WHERE s.company_id = ? AND s.balance_due > 0 AND s.status != 'CANCELLED'
      GROUP BY v.id
      ORDER BY total_due DESC
      `,
      [companyId]
    );
    return { rows };
  } else {
    // AP
    const [rows] = await pool.query(
      `
      SELECT 
        v.id AS vendor_id,
        v.code AS vendor_code,
        v.name AS vendor_name,
        SUM(CASE WHEN DATEDIFF(CURDATE(), b.issue_date) <= 30 THEN b.balance_due ELSE 0 END) AS age_0_30,
        SUM(CASE WHEN DATEDIFF(CURDATE(), b.issue_date) BETWEEN 31 AND 60 THEN b.balance_due ELSE 0 END) AS age_31_60,
        SUM(CASE WHEN DATEDIFF(CURDATE(), b.issue_date) BETWEEN 61 AND 90 THEN b.balance_due ELSE 0 END) AS age_61_90,
        SUM(CASE WHEN DATEDIFF(CURDATE(), b.issue_date) > 90 THEN b.balance_due ELSE 0 END) AS age_over_90,
        SUM(b.balance_due) AS total_due
      FROM purchase_bills b
      JOIN vendors v ON v.id = b.vendor_id
      WHERE b.company_id = ? AND b.balance_due > 0 AND b.status = 'APPROVED'
      GROUP BY v.id
      ORDER BY total_due DESC
      `,
      [companyId]
    );
    return { rows };
  }
}
