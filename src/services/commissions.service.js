import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";

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

    const payAmount = totalUnpaid; 

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

    const [commPayRes] = await conn.query(
      `
      INSERT INTO commission_payments (
        company_id, seller_id, period_start, period_end, total_amount, 
        finance_account_id, finance_transaction_id, paid_by, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [companyId, seller_id, periodStart, periodEnd, payAmount, finance_account_id, financeTxId, adminId, note]
    );
    const commissionPaymentId = commPayRes.insertId;

    // 6. Update sales invoices to mark as paid
    const [updateRes] = await conn.query(
      `
      UPDATE sales s
      SET s.commission_paid = TRUE, s.commission_payment_id = ? 
      WHERE ${whereSql}
      `,
      [commissionPaymentId, ...queryParams]
    );

    await conn.commit();
    return { 
      success: true, 
      payment_id: commissionPaymentId, 
      amount_paid: payAmount,
      invoices_updated: updateRes.affectedRows
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
      (SELECT COUNT(*) FROM sales s WHERE s.commission_payment_id = cp.id) AS invoice_count
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
