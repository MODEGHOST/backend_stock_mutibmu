import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { generateDocNo } from "./documentNo.service.js";

/**
 * Get unpaid commissions grouped by seller
 */
export async function getUnpaidCommissionsSummary(companyId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      s.seller_id,
      u.email AS seller_email,
      CONCAT(u.first_name, ' ', u.last_name) AS seller_name,
      COUNT(DISTINCT s.id) AS inv_count,
      COALESCE(SUM(si.commission_total), 0) AS unpaid_commission_total
    FROM sales s
    JOIN sales_items si ON si.sales_id = s.id
    JOIN users u ON u.id = s.seller_id
    WHERE s.company_id = ?
      AND s.status IN ('CONFIRMED', 'SHIPPED')
      AND s.issue_date BETWEEN ? AND ?
      AND s.commission_paid = FALSE
    GROUP BY s.seller_id
    HAVING unpaid_commission_total > 0
    ORDER BY unpaid_commission_total DESC
    `,
    [companyId, from, to]
  );
  return { rows };
}

/**
 * Get detailed unpaid invoices for a specific seller
 */
export async function getUnpaidCommissionInvoices(companyId, sellerId, from, to) {
  const [rows] = await pool.query(
    `
    SELECT
      s.id AS sale_id,
      s.invoice_no,
      s.issue_date,
      s.total AS invoice_total,
      s.cogs_total AS cost_total,
      (s.total - COALESCE(s.cogs_total, 0)) AS profit_total,
      COALESCE(SUM(si.commission_total), 0) AS commission_total
    FROM sales s
    JOIN sales_items si ON si.sales_id = s.id
    WHERE s.company_id = ?
      AND s.seller_id = ?
      AND s.status IN ('CONFIRMED', 'SHIPPED')
      AND s.issue_date BETWEEN ? AND ?
      AND s.commission_paid = FALSE
    GROUP BY s.id
    ORDER BY s.issue_date ASC
    `,
    [companyId, sellerId, from, to]
  );
  return { rows };
}

/**
 * Pay commissions to a seller
 */
export async function payCommission(companyId, adminId, body) {
  const { seller_id, from, to, invoice_ids, finance_account_id, amount, note } = body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let whereSql = `s.company_id = ? AND s.seller_id = ? AND s.status IN ('CONFIRMED', 'SHIPPED') AND s.commission_paid = FALSE`;
    let queryParams = [companyId, seller_id];

    if (invoice_ids && invoice_ids.length > 0) {
      whereSql += ` AND s.id IN (?)`;
      queryParams.push(invoice_ids);
    } else {
      whereSql += ` AND s.issue_date BETWEEN ? AND ?`;
      queryParams.push(from, to);
    }

    // 1. Verify seller has unpaid commissions based on condition
    const [unpaid] = await conn.query(
      `
      SELECT COALESCE(SUM(si.commission_total), 0) AS total_unpaid
      FROM sales s
      JOIN sales_items si ON si.sales_id = s.id
      WHERE ${whereSql}
      `,
      queryParams
    );

    const totalUnpaid = Number(unpaid[0]?.total_unpaid || 0);
    if (totalUnpaid <= 0) {
      throw new HttpError(400, "ไม่มีรายการค่าคอมมิชชั่นค้างจ่ายในช่วงเวลานี้สำหรับพนักงานคนดังกล่าว หรือบิลที่เลือกจ่ายไปแล้ว");
    }

    let payAmount = totalUnpaid; 
    let paymentItems = []; // {sale_id, original_amount, paid_amount}

    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      payAmount = body.items.reduce((sum, item) => sum + Number(item.paid_amount || 0), 0);
      paymentItems = body.items;
    } else {
      const [invs] = await conn.query(
        `SELECT s.id as sale_id, COALESCE(SUM(si.commission_total), 0) AS commission_total
         FROM sales s JOIN sales_items si ON si.sales_id = s.id
         WHERE ${whereSql} GROUP BY s.id`, queryParams
      );
      paymentItems = invs.map(inv => ({ sale_id: inv.sale_id, original_amount: inv.commission_total, paid_amount: inv.commission_total }));
    }

    if (payAmount <= 0) {
      throw new HttpError(400, "ยอดเงินที่จ่ายสุทธิต้องมากกว่า 0");
    }

    // 2. Validate Finance Account it belongs to company
    const [finAccs] = await conn.query(
      `SELECT id, balance FROM finance_accounts WHERE id = ? AND company_id = ? LIMIT 1`,
      [finance_account_id, companyId]
    );
    if (finAccs.length === 0) throw new HttpError(404, "ไม่พบบัญชีการเงินที่ระบุ");
    
    // 3. Create finance transaction (EXPENSE)
    const [finTxRes] = await conn.query(
      `
      INSERT INTO finance_transactions (
        company_id, finance_account_id, transaction_type, amount, reference_type, note, created_by
      ) VALUES (?, ?, 'EXPENSE', ?, 'COMMISSION', ?, ?)
      `,
      [companyId, finance_account_id, payAmount, note || "จ่ายค่าคอมมิชชั่น", adminId]
    );
    const financeTxId = finTxRes.insertId;

    // 4. Update finance account balance (deduct)
    await conn.query(
      `UPDATE finance_accounts SET balance = balance - ? WHERE id = ?`,
      [payAmount, finance_account_id]
    );

    // 5. Create commission_payment record
    const periodStart = from || new Date().toISOString().split('T')[0];
    const periodEnd = to || new Date().toISOString().split('T')[0];

    // Generate Document Number
    const documentNo = await generateDocNo(conn, companyId, "CP", new Date());

    const [commPayRes] = await conn.query(
      `
      INSERT INTO commission_payments (
        company_id, document_no, seller_id, period_start, period_end, total_amount, 
        finance_account_id, finance_transaction_id, paid_by, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [companyId, documentNo, seller_id, periodStart, periodEnd, payAmount, finance_account_id, financeTxId, adminId, note]
    );
    const commissionPaymentId = commPayRes.insertId;

    // 6. Create commission_payment_items
    if (paymentItems.length > 0) {
      const itemsValues = paymentItems.map(item => [
        commissionPaymentId,
        item.sale_id,
        item.original_amount,
        item.paid_amount
      ]);
      await conn.query(
        `INSERT INTO commission_payment_items (commission_payment_id, sale_id, original_amount, paid_amount) VALUES ?`,
        [itemsValues]
      );
    }

    // 7. Update sales invoices to mark as paid
    const updateSaleIds = paymentItems.map(item => item.sale_id);
    let affectedRows = 0;
    if (updateSaleIds.length > 0) {
      const [updateRes] = await conn.query(
        `UPDATE sales s SET s.commission_paid = TRUE, s.commission_payment_id = ? WHERE s.id IN (?) AND s.company_id = ?`,
        [commissionPaymentId, updateSaleIds, companyId]
      );
      affectedRows = updateRes.affectedRows;
    }

    await conn.commit();
    return { 
      success: true, 
      payment_id: commissionPaymentId, 
      amount_paid: payAmount,
      invoices_updated: affectedRows
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

/**
 * Get Commission Payment History
 */
export async function getCommissionPaymentHistory(companyId, limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `
    SELECT 
      cp.*,
      u.email AS seller_email,
      CONCAT(u.first_name, ' ', u.last_name) AS seller_name,
      a.email AS admin_email,
      CONCAT(a.first_name, ' ', a.last_name) AS admin_name,
      fa.name AS finance_account_name,
      (SELECT COUNT(*) FROM sales s WHERE s.commission_payment_id = cp.id) AS invoice_count,
      IFNULL((SELECT SUM(original_amount) FROM commission_payment_items cpi WHERE cpi.commission_payment_id = cp.id), cp.total_amount) AS original_total
    FROM commission_payments cp
    JOIN users u ON u.id = cp.seller_id
    JOIN users a ON a.id = cp.paid_by
    JOIN finance_accounts fa ON fa.id = cp.finance_account_id
    WHERE cp.company_id = ?
    ORDER BY cp.created_at DESC
    LIMIT ? OFFSET ?
    `,
    [companyId, limit, offset]
  );

  const [countRes] = await pool.query(
    `SELECT COUNT(*) as total FROM commission_payments WHERE company_id = ?`,
    [companyId]
  );

  return { rows, total: countRes[0].total };
}

/**
 * Get Commission Payment Statement Items
 */
export async function getCommissionPaymentItems(companyId, paymentId) {
  const [rows] = await pool.query(
    `
    SELECT 
      cpi.*,
      s.invoice_no,
      s.issue_date,
      s.total as invoice_total,
      s.cogs_total as cost_total,
      (s.total - COALESCE(s.cogs_total, 0)) as profit_total
    FROM commission_payment_items cpi
    JOIN sales s ON s.id = cpi.sale_id
    WHERE cpi.commission_payment_id = ? AND s.company_id = ?
    ORDER BY s.issue_date ASC
    `,
    [paymentId, companyId]
  );
  return { rows };
}
