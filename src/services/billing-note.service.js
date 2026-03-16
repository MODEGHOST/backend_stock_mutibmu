// src/services/billing-note.service.js
import { withTx, pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";

// Uses documentNo.service.js internally for generating Doc IDs (e.g. BL-202603-0001)
// We will reuse "BL" as prefix

export async function createBillingNote(companyId, userId, data) {
  return await withTx(async (conn) => {
    const { customer_id, issue_date, due_date, note, sales_ids } = data;

    // Verify customer exists and is a CUSTOMER
    const [custRows] = await conn.query(
      `SELECT id FROM vendors WHERE id=:customer_id AND company_id=:companyId AND type IN ('CUSTOMER', 'BOTH') LIMIT 1`,
      { customer_id, companyId }
    );
    if (custRows.length === 0) throw new HttpError(400, "Invalid customer_id or vendor is not a customer");

    // Verify all sales belong to this customer and company and are valid IVs
    const [salesRows] = await conn.query(
      `SELECT id, invoice_no, total, status FROM sales WHERE id IN (:sales_ids) AND company_id=:companyId AND customer_id=:customer_id`,
      { sales_ids, companyId, customer_id }
    );

    if (salesRows.length !== sales_ids.length) {
      throw new HttpError(400, "One or more invoices do not exist, do not belong to the customer, or are invalid.");
    }

    let totalAmount = 0;
    for (const sale of salesRows) {
      if (sale.status !== 'CONFIRMED' && sale.status !== 'SHIPPED') {
         throw new HttpError(400, `Invoice ${sale.invoice_no} (${sale.id}) is not CONFIRMED/SHIPPED yet.`);
      }
      totalAmount += Number(sale.total) || 0;
    }

    // Generate Document Number directly
    const { generateDocNo } = await import("./documentNo.service.js");
    const docNo = await generateDocNo(conn, companyId, "BL", issue_date);

    // Insert Billing Note
    const [r] = await conn.query(
      `
      INSERT INTO billing_notes (
        company_id, doc_no, doc_date, due_date, customer_id,
        status, total_amount, note, created_by
      ) VALUES (
        :company_id, :doc_no, :doc_date, :due_date, :customer_id,
        'ISSUED', :total_amount, :note, :created_by
      )
      `,
      {
        company_id: companyId,
        doc_no: docNo,
        doc_date: issue_date,
        due_date: due_date || null,
        customer_id: customer_id,
        total_amount: totalAmount,
        note: note || null,
        created_by: userId,
      }
    );

    const billingNoteId = r.insertId;

    // Insert Items Mapping
    for (const saleId of sales_ids) {
      await conn.query(
        `INSERT INTO billing_note_items (billing_note_id, sales_id) VALUES (:billingNoteId, :saleId)`,
        { billingNoteId, saleId }
      );
    }

    return { ok: true, id: billingNoteId, doc_no: docNo };
  });
}

export async function listBillingNotes(companyId, { q, limit, offset }) {
  const kw = q ? `%${q}%` : null;

  let where = `WHERE b.company_id=:companyId`;
  const params = { companyId, kw, limit, offset };

  if (kw) {
    where += ` AND (b.doc_no LIKE :kw OR v.name LIKE :kw)`;
  }

  const [rows] = await pool.query(
    `
    SELECT b.id, b.doc_no, b.doc_date, b.due_date, b.status, b.total_amount, b.note,
           v.name as customer_name, v.code as customer_code
    FROM billing_notes b
    LEFT JOIN vendors v ON v.id = b.customer_id AND v.company_id = b.company_id
    ${where}
    ORDER BY b.id DESC
    LIMIT :limit OFFSET :offset
    `,
    params
  );

  const [cnt] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM billing_notes b
    LEFT JOIN vendors v ON v.id = b.customer_id AND v.company_id = b.company_id
    ${where}
    `,
    params
  );

  return { rows, total: Number(cnt?.[0]?.total || 0) };
}

export async function getBillingNote(companyId, id) {
  const [h] = await pool.query(
    `SELECT b.*,
            v.name as customer_name,
            v.code as customer_code,
            v.address as customer_address,
            v.tax_id as customer_tax_id
     FROM billing_notes b
     LEFT JOIN vendors v ON v.id = b.customer_id AND v.company_id = b.company_id
     WHERE b.id=:id AND b.company_id=:companyId
     LIMIT 1`,
    { id, companyId }
  );

  if (h.length === 0) throw new HttpError(404, "Not found");

  const [items] = await pool.query(
    `
    SELECT bi.id as item_id,
           s.id as sales_id, s.invoice_no, s.issue_date, s.total, s.status as sales_status,
           s.quotation_no, s.delivery_no,
           s.payment_status, s.paid_amount, s.balance_due
    FROM billing_note_items bi
    JOIN sales s ON s.id = bi.sales_id
    WHERE bi.billing_note_id=:id
    ORDER BY bi.id ASC
    `,
    { id }
  );

  return { header: h[0], items };
}

export async function cancelBillingNote(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT status FROM billing_notes WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId }
    );
    if (h.length === 0) throw new HttpError(404, "Not found");
    if (h[0].status === "CANCELLED") throw new HttpError(400, "Already cancelled");

    await conn.query(
      `UPDATE billing_notes SET status='CANCELLED', updated_at=NOW() WHERE id=:id AND company_id=:companyId`,
      { id, companyId }
    );

    return { ok: true };
  });
}

export async function payBillingNote(companyId, userId, id, amount) {
  return await withTx(async (conn) => {
    // 1. Get Billing Note
    const [h] = await conn.query(
      `SELECT * FROM billing_notes WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId }
    );
    if (h.length === 0) throw new HttpError(404, "Billing Note not found");
    if (h[0].status === "CANCELLED") throw new HttpError(400, "Billing Note is cancelled");

    // 2. Get IVs that are not fully paid
    const [items] = await conn.query(
      `SELECT s.id, s.total, s.paid_amount, s.balance_due
       FROM billing_note_items bi
       JOIN sales s ON s.id = bi.sales_id
       WHERE bi.billing_note_id=:id AND s.payment_status != 'PAID'
       ORDER BY bi.id ASC`,
      { id }
    );

    if (items.length === 0) throw new HttpError(400, "All invoices in this Billing Note are already paid.");

    // 3. Generate Receipt
    const { generateDocNo } = await import("./documentNo.service.js");
    const issueDate = new Date();
    const receiptNo = await generateDocNo(conn, companyId, "RE", issueDate);

    let remainingAmount = Number(amount);

    // 4. Distribute payment across IVs
    for (const item of items) {
      if (remainingAmount <= 0) break;

      const balance = Number(item.balance_due);
      const toPay = Math.min(balance, remainingAmount);

      const newPaid = Number(item.paid_amount) + toPay;
      const newBalance = balance - toPay;
      const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';

      await conn.query(
        `UPDATE sales 
         SET payment_status = ?, paid_amount = ?, balance_due = ?, 
             receipt_no = IFNULL(receipt_no, ?), receipt_date = IFNULL(receipt_date, ?)
         WHERE id = ?`,
        [newStatus, newPaid, newBalance, receiptNo, issueDate, item.id]
      );

      remainingAmount -= toPay;
    }

    return { ok: true, receipt_no: receiptNo, receipt_date: issueDate };
  });
}
