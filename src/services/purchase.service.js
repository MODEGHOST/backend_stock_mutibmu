// purchase.service.js
import { withTx, pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";
import { generateDocNo } from "./documentNo.service.js";

/**
 * Assumptions (DB columns) สำหรับโหมด BILL -> GRN (partial receive)
 * - goods_receipts: มีคอลัมน์ bill_id (NULL ได้)
 * - goods_receipt_items: มีคอลัมน์ bill_item_id (NULL ได้)
 *   (ถ้ายังไม่มี 2 ตัวนี้ ให้เพิ่มก่อน ไม่งั้น query/insert จะพัง)
 */

// -------------------------
// Normalizers / Validators
// -------------------------
function normalizeDocNo(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "undefined") return null;
  return s;
}

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
  if (!re.test(s)) {
    throw new HttpError(400, "Invalid date format (YYYY-MM-DD required)");
  }

  return s;
}


function isDupErr(e) {
  return e && (e.code === "ER_DUP_ENTRY" || e.errno === 1062);
}

function wrapDupAsHttp(e, docType) {
  const msg = e?.sqlMessage || e?.message || "Duplicate entry";
  return new HttpError(409, `${docType} number already exists: ${msg}`);
}

function wrapBillDupAsHttp(e) {
  const msg = (e?.sqlMessage || e?.message || "Duplicate entry").toString();
  if (msg.includes("uq_bill_company_bill_no") || msg.includes("bill_no")) {
    return new HttpError(409, `เลขที่เอกสารบันทึกซื้อ (bill_no) ซ้ำ`);
  }
  if (
    msg.includes("uq_bill_company_tax_invoice_no") ||
    msg.includes("tax_invoice_no")
  ) {
    return new HttpError(409, `เลขที่ใบกำกับภาษี (tax_invoice_no) ซ้ำ`);
  }
  return new HttpError(409, `เลขเอกสารซ้ำ: ${msg}`);
}

function ensurePositiveInt(n, name) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0 || Math.floor(x) !== x) {
    throw new HttpError(400, `${name} is invalid`);
  }
  return x;
}

function ensureNonNeg(n, name) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0)
    throw new HttpError(400, `${name} is invalid`);
  return x;
}

function ensurePct(n, name) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0 || x > 100)
    throw new HttpError(400, `${name} is invalid`);
  return x;
}

function normalizeTaxType(v) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s === "EXCLUDE_VAT_7" || s === "INCLUDE_VAT_7" || s === "NO_VAT")
    return s;
  return "EXCLUDE_VAT_7";
}

function calcLineNet({ qty, unit_cost, discount_pct, discount_amt }) {
  const base = Number(qty) * Number(unit_cost);
  const discPct = base * (Number(discount_pct) / 100);
  const discAmt = Number(discount_amt);
  const discount = Math.min(base, discPct + discAmt);
  return Math.max(0, base - discount);
}

// -------------------------
// Items validators
// -------------------------

// ใช้กับ PO/BILL (มีส่วนลด/ภาษี)
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "items is required");
  }
  const out = [];
  for (const it of items) {
    const product_id = ensurePositiveInt(it?.product_id, "product_id");

    const qty = Number(it?.qty);
    if (!Number.isFinite(qty) || qty <= 0)
      throw new HttpError(400, "qty must be > 0");

    const unit_cost = ensureNonNeg(it?.unit_cost ?? 0, "unit_cost");
    const discount_pct = ensurePct(it?.discount_pct ?? 0, "discount_pct");
    const discount_amt = ensureNonNeg(it?.discount_amt ?? 0, "discount_amt");
    const tax_type = normalizeTaxType(it?.tax_type);
    
    let manual_vat = null;
    if (it.manual_vat !== undefined && it.manual_vat !== null) {
      manual_vat = ensureNonNeg(it.manual_vat, "manual_vat");
    }

    out.push({
      product_id,
      qty,
      unit_cost,
      discount_pct,
      discount_amt,
      tax_type,
      manual_vat,
    });
  }
  return out;
}

// ใช้กับ GRN (รองรับ bill_item_id)
function validateGrnItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "items is required");
  }
  const out = [];
  for (const it of items) {
    const bill_item_id =
      it?.bill_item_id === null || it?.bill_item_id === undefined
        ? null
        : ensurePositiveInt(it.bill_item_id, "bill_item_id");

    const product_id = ensurePositiveInt(it?.product_id, "product_id");

    const qty = Number(it?.qty);
    if (!Number.isFinite(qty) || qty <= 0)
      throw new HttpError(400, "qty must be > 0");

    const unit_cost = ensureNonNeg(it?.unit_cost ?? 0, "unit_cost");
    const discount_pct = ensurePct(it?.discount_pct ?? 0, "discount_pct");
    const discount_amt = ensureNonNeg(it?.discount_amt ?? 0, "discount_amt");
    const tax_type = normalizeTaxType(it?.tax_type);
    
    let manual_vat = null;
    if (it.manual_vat !== undefined && it.manual_vat !== null) {
      manual_vat = ensureNonNeg(it.manual_vat, "manual_vat");
    }

    out.push({
      bill_item_id,
      product_id,
      qty,
      unit_cost,
      discount_pct,
      discount_amt,
      tax_type,
      manual_vat,
    });
  }
  return out;
}

async function assertManualAllowed(conn, companyId, docType) {
  const [[cfg]] = await conn.query(
    `
    SELECT allow_manual, manual_regex
    FROM company_doc_configs
    WHERE company_id=:companyId AND doc_type=:docType
    LIMIT 1
    `,
    { companyId, docType },
  );

  if (!cfg || !cfg.allow_manual) {
    throw new HttpError(400, `Manual ${docType} number is not allowed`);
  }

  if (cfg.manual_regex) {
    try {
      return new RegExp(cfg.manual_regex);
    } catch {
      throw new HttpError(500, `Invalid manual_regex config for ${docType}`);
    }
  }
  return null;
}

// -------------------------
// BILL helpers
// -------------------------
async function loadVendorPersonOrPrimary(
  conn,
  companyId,
  vendor_id,
  vendor_person_id,
) {
  let person = null;

  if (vendor_person_id) {
    const [rows] = await conn.query(
      `
      SELECT vp.*
      FROM vendor_people vp
      JOIN vendors v ON v.id = vp.vendor_id
      WHERE vp.id = :personId
        AND vp.vendor_id = :vendorId
        AND v.company_id = :companyId
      LIMIT 1
      `,
      { personId: vendor_person_id, vendorId: vendor_id, companyId },
    );
    if (rows.length === 0)
      throw new HttpError(400, "vendor_person_id not found for this vendor");
    person = rows[0];
  } else {
    const [rows] = await conn.query(
      `
      SELECT vp.*
      FROM vendor_people vp
      JOIN vendors v ON v.id = vp.vendor_id
      WHERE vp.vendor_id = :vendorId
        AND v.company_id = :companyId
      ORDER BY vp.is_primary DESC, vp.sort_order ASC, vp.id ASC
      LIMIT 1
      `,
      { vendorId: vendor_id, companyId },
    );
    if (rows.length === 0)
      throw new HttpError(400, "vendor_people required (at least 1)");
    person = rows[0];
  }

  return person;
}

// -------------------------
// GRN helpers (bill-based)
// -------------------------
async function loadBillForGrn(conn, companyId, bill_id) {
  const [rows] = await conn.query(
    `
    SELECT *
    FROM purchase_bills
    WHERE id=:id AND company_id=:companyId
    LIMIT 1
    FOR UPDATE
    `,
    { id: bill_id, companyId },
  );
  if (rows.length === 0) throw new HttpError(404, "BILL not found");
  return rows[0];
}

async function loadBillItemsForGrn(conn, bill_id) {
  const [rows] = await conn.query(
    `
    SELECT
      i.id,
      i.product_id,
      i.qty,
      i.unit_cost
    FROM purchase_bill_items i
    WHERE i.purchase_bill_id=:bill_id
    ORDER BY i.id ASC
    FOR UPDATE
    `,
    { bill_id },
  );
  if (rows.length === 0) throw new HttpError(400, "BILL has no items");
  return rows;
}

async function getApprovedReceivedQtyByBillItems(conn, companyId, bill_id) {
  // นับเฉพาะ GRN ที่ APPROVED และไม่ CANCELLED
  const [rows] = await conn.query(
    `
    SELECT
      gi.bill_item_id,
      COALESCE(SUM(gi.qty), 0) AS received_qty
    FROM goods_receipts g
    JOIN goods_receipt_items gi ON gi.goods_receipt_id = g.id
    WHERE g.company_id=:companyId
      AND g.bill_id=:bill_id
      AND g.status='APPROVED'
      AND gi.bill_item_id IS NOT NULL
    GROUP BY gi.bill_item_id
    `,
    { companyId, bill_id },
  );

  const map = new Map();
  for (const r of rows) map.set(Number(r.bill_item_id), Number(r.received_qty));
  return map;
}

// =========================
// BILL (บันทึกซื้อ) - FULL like PO
// =========================

function normalizeHeaderDiscountType(v) {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s === "PERCENT" || s === "AMOUNT") return s;
  return "AMOUNT"; // default เหมือน PO
}

function ensureHeaderDiscountValue(type, value) {
  if (type === "PERCENT") return ensurePct(value ?? 0, "header_discount_value");
  return ensureNonNeg(value ?? 0, "header_discount_value");
}

function calcHeaderDiscount(base, type, value) {
  const b = Number(base) || 0;
  if (type === "PERCENT") {
    const pct = Number(value) || 0;
    return Math.max(0, b * (pct / 100));
  }
  return Math.max(0, Number(value) || 0);
}

export async function createBill(companyId, userId, data) {
  return await withTx(async (conn) => {
    const issue_date = normalizeDateStr(data?.issue_date);
    const paid_date = data?.paid_date ? normalizeDateStr(data.paid_date) : null;
    const finance_account_id = data?.finance_account_id ? ensurePositiveInt(data.finance_account_id, "finance_account_id") : null;
    
    if (!issue_date) throw new HttpError(400, "issue_date is required");

    const bill_no = normalizeRequiredStr(data?.bill_no, "bill_no");
    const tax_invoice_no = normalizeRequiredStr(
      data?.tax_invoice_no,
      "tax_invoice_no",
    );

    const po_id = data?.po_id ? ensurePositiveInt(data.po_id, "po_id") : null;

    const vendor_id = ensurePositiveInt(data?.vendor_id, "vendor_id");
    const warehouse_id = ensurePositiveInt(data?.warehouse_id, "warehouse_id");
    const note = normalizeStr(data?.note);

    // ---- header discount (เหมือน PO) ----
    const header_discount_type = normalizeHeaderDiscountType(
      data?.header_discount_type,
    );
    const header_discount_value = ensureHeaderDiscountValue(
      header_discount_type,
      data?.header_discount_value,
    );

    const extra_charge_amt = ensureNonNeg(
      data?.extra_charge_amt ?? 0,
      "extra_charge_amt",
    );
    const extra_charge_note = normalizeStr(data?.extra_charge_note);

    const items = validateItems(data?.items);

    const vendor_person_id = data?.vendor_person_id
      ? ensurePositiveInt(data.vendor_person_id, "vendor_person_id")
      : null;

    const person = await loadVendorPersonOrPrimary(
      conn,
      companyId,
      vendor_id,
      vendor_person_id,
    );

    let billId;
    try {
      const [r] = await conn.query(
        `
        INSERT INTO purchase_bills
          (
            company_id,
            bill_no,
            tax_invoice_no,
            po_id,
            paid_date,
            finance_account_id,
            vendor_id,

            vendor_person_id,
            vendor_person_prefix,
            vendor_person_first_name,
            vendor_person_last_name,
            vendor_person_nickname,
            vendor_person_email,
            vendor_person_phone,
            vendor_person_position,
            vendor_person_department,

            warehouse_id,
            status,
            issue_date,
            note,
            extra_charge_amt,
            extra_charge_note,

            header_discount_type,
            header_discount_value,

            created_by,
            is_manual
          )
        VALUES
          (
            :company_id,
            :bill_no,
            :tax_invoice_no,
            :po_id,
            :paid_date,
            :finance_account_id,
            :vendor_id,

            :vendor_person_id,
            :vendor_person_prefix,
            :vendor_person_first_name,
            :vendor_person_last_name,
            :vendor_person_nickname,
            :vendor_person_email,
            :vendor_person_phone,
            :vendor_person_position,
            :vendor_person_department,

            :warehouse_id,
            'DRAFT',
            :issue_date,
            :note,
            :extra_charge_amt,
            :extra_charge_note,

            :header_discount_type,
            :header_discount_value,

            :created_by,
            1
          )
        `,
        {
          company_id: companyId,
          bill_no,
          tax_invoice_no,
          po_id,
          paid_date,
          finance_account_id,
          vendor_id,

          vendor_person_id: person?.id ?? null,
          vendor_person_prefix: person?.prefix ?? null,
          vendor_person_first_name: person?.first_name ?? null,
          vendor_person_last_name: person?.last_name ?? null,
          vendor_person_nickname: person?.nickname ?? null,
          vendor_person_email: person?.email ?? null,
          vendor_person_phone: person?.phone ?? null,
          vendor_person_position: person?.position ?? null,
          vendor_person_department: person?.department ?? null,

          warehouse_id,
          issue_date,
          note,
          extra_charge_amt,
          extra_charge_note,

          header_discount_type,
          header_discount_value,

          created_by: userId,
        },
      );
      billId = r.insertId;
    } catch (e) {
      if (isDupErr(e)) throw wrapBillDupAsHttp(e);
      throw e;
    }

    for (const it of items) {
      await conn.query(
        `
        INSERT INTO purchase_bill_items
          (purchase_bill_id, product_id, qty, unit_cost, discount_pct, discount_amt, tax_type, manual_vat)
        VALUES
          (:purchase_bill_id, :product_id, :qty, :unit_cost, :discount_pct, :discount_amt, :tax_type, :manual_vat)
        `,
        {
          purchase_bill_id: billId,
          product_id: it.product_id,
          qty: it.qty,
          unit_cost: it.unit_cost ?? 0,
          discount_pct: it.discount_pct ?? 0,
          discount_amt: it.discount_amt ?? 0,
          tax_type: it.tax_type ?? "EXCLUDE_VAT_7",
          manual_vat: it.manual_vat ?? null,
        },
      );
    }

    // Calculate Total for Finance Transaction
    if (paid_date && finance_account_id) {
      let subtotal = 0;
      for (const it of items) {
        subtotal += calcLineNet(it);
      }
      const base = subtotal + extra_charge_amt;
      const header_discount_amt = calcHeaderDiscount(
        base,
        header_discount_type,
        header_discount_value,
      );
      const total_amount = Math.max(0, base - header_discount_amt);

      if (total_amount > 0) {
        // Update finance account balance
        const [faRows] = await conn.query(
          `SELECT balance FROM finance_accounts WHERE id=:finance_account_id AND company_id=:company_id FOR UPDATE`,
          { finance_account_id, company_id: companyId }
        );
        if (faRows.length === 0) throw new HttpError(404, "Finance Account not found");

        await conn.query(
          `UPDATE finance_accounts SET balance = balance - :total_amount WHERE id=:finance_account_id`,
          { total_amount, finance_account_id }
        );

        // Record transaction
        await conn.query(
          `
          INSERT INTO finance_transactions (
            company_id, finance_account_id, transaction_type, amount, reference_type, reference_id, transaction_date, created_by
          ) VALUES (
            :company_id, :finance_account_id, 'EXPENSE', :total_amount, 'PURCHASE_BILL', :billId, :paid_date, :userId
          )
          `,
          { company_id: companyId, finance_account_id, total_amount, billId, paid_date, userId }
        );
      }
    }

    return {
      id: billId,
      bill_no,
      tax_invoice_no,
    };
  });
}

export async function getBill(companyId, id) {
  const [h] = await pool.query(
    `SELECT * FROM purchase_bills WHERE id=:id AND company_id=:companyId LIMIT 1`,
    { id, companyId },
  );
  if (h.length === 0) throw new HttpError(404, "Not found");

  const header = h[0];

  const [items] = await pool.query(
    `
    SELECT
      i.id,
      i.product_id,
      p.code,
      p.name,
      i.qty,
      i.unit_cost,
      i.discount_pct,
      i.discount_amt,
      i.tax_type,
      i.manual_vat,
      GREATEST(
        0,
        (i.qty * i.unit_cost)
        - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
        - i.discount_amt
      ) AS line_net
    FROM purchase_bill_items i
    JOIN products p ON p.id=i.product_id
    WHERE i.purchase_bill_id=:id
    ORDER BY i.id ASC
    `,
    { id },
  );

  // ---- totals (ครบแบบ PO) ----
  const subtotal = items.reduce((sum, it) => sum + Number(it.line_net || 0), 0);

  const extra_charge_amt = Number(header.extra_charge_amt || 0);

  const header_discount_type = normalizeHeaderDiscountType(
    header.header_discount_type,
  );
  const header_discount_value = ensureHeaderDiscountValue(
    header_discount_type,
    header.header_discount_value,
  );

  const base = subtotal + extra_charge_amt;
  const header_discount_amt = calcHeaderDiscount(
    base,
    header_discount_type,
    header_discount_value,
  );

  const total_amount = Math.max(0, base - header_discount_amt);

  return {
    header: {
      ...header,
      paid_date: header.paid_date ?? null,
      extra_charge_amt,
      header_discount_type,
      header_discount_value,
    },
    items,
    totals: {
      subtotal,
      extra_charge_amt,
      base,
      header_discount_type,
      header_discount_value,
      header_discount_amt,
      total_amount,
    },
  };
}

export async function approveBill(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM purchase_bills WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const bill = h[0];
    if (bill.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");
    if (bill.status !== "DRAFT") throw new HttpError(400, "Invalid status");

    const [items] = await conn.query(
      `
      SELECT id
      FROM purchase_bill_items
      WHERE purchase_bill_id=:id
      ORDER BY id ASC
      FOR UPDATE
      `,
      { id },
    );
    if (items.length === 0) throw new HttpError(400, "No items");

    await conn.query(
      `UPDATE purchase_bills SET status='APPROVED', approved_by=:approved_by, approved_at=NOW() WHERE id=:id`,
      { approved_by: userId, id },
    );

    return { ok: true };
  });
}

export async function setBillPaid(companyId, userId, id, paidDate, financeAccountId) {
  return await withTx(async (conn) => {
    const date = paidDate === null ? null : normalizeDateStr(paidDate);
    const finance_account_id = financeAccountId ? ensurePositiveInt(financeAccountId, "financeAccountId") : null;

    const [rows] = await conn.query(
      `SELECT * FROM purchase_bills
       WHERE id=:id AND company_id=:companyId
       LIMIT 1 FOR UPDATE`,
      { id, companyId }
    );

    if (rows.length === 0)
      throw new HttpError(404, "BILL not found");

    const bill = rows[0];

    // If it was already paid, maybe we need to reverse the old transaction? 
    // For simplicity in this implementation, if they change the paid status or account, we just update.
    // Ideally we shouldn't allow changing paid_date easily without reversing.
    if (bill.paid_date && bill.finance_account_id) {
       // Reverse old transaction
       const oldTotal = await getBillTotalSubquery(conn, id, bill.extra_charge_amt || 0, bill.header_discount_type, bill.header_discount_value || 0);
       await conn.query(`UPDATE finance_accounts SET balance = balance + :oldTotal WHERE id=:oldAccountId`, { oldTotal, oldAccountId: bill.finance_account_id });
       await conn.query(`DELETE FROM finance_transactions WHERE reference_type='PURCHASE_BILL' AND reference_id=:id`, { id });
    }

    await conn.query(
      `
      UPDATE purchase_bills
      SET paid_date=:paid_date, finance_account_id=:finance_account_id
      WHERE id=:id AND company_id=:companyId
      `,
      {
        id,
        companyId,
        paid_date: date,
        finance_account_id
      }
    );

    if (date && finance_account_id) {
        const currentTotal = await getBillTotalSubquery(conn, id, bill.extra_charge_amt || 0, bill.header_discount_type, bill.header_discount_value || 0);
        if (currentTotal > 0) {
           const [faRows] = await conn.query(
             `SELECT balance FROM finance_accounts WHERE id=:finance_account_id AND company_id=:companyId FOR UPDATE`,
             { finance_account_id, companyId }
           );
           if (faRows.length === 0) throw new HttpError(404, "Finance Account not found");

           await conn.query(
             `UPDATE finance_accounts SET balance = balance - :currentTotal WHERE id=:finance_account_id`,
             { currentTotal, finance_account_id }
           );

           await conn.query(
             `
             INSERT INTO finance_transactions (
               company_id, finance_account_id, transaction_type, amount, reference_type, reference_id, transaction_date, created_by
             ) VALUES (
               :companyId, :finance_account_id, 'EXPENSE', :currentTotal, 'PURCHASE_BILL', :id, :date, :userId
             )
             `,
             { companyId, finance_account_id, currentTotal, id, date, userId }
           );
        }
    }

    return { ok: true, paid_date: date, finance_account_id };
  });
}

// Helper for setBillPaid to get total
async function getBillTotalSubquery(conn, billId, extraCharge, discountType, discountValue) {
  const [items] = await conn.query(
    `SELECT qty, unit_cost, discount_pct, discount_amt FROM purchase_bill_items WHERE purchase_bill_id=:billId`,
    { billId }
  );
  let subtotal = 0;
  for(const it of items) {
     subtotal += calcLineNet(it);
  }
  const base = subtotal + Number(extraCharge);
  const header_discount_amt = calcHeaderDiscount(base, discountType, discountValue);
  return Math.max(0, base - header_discount_amt);
}

export async function cancelBill(companyId, userId, id, reason) {
  return await withTx(async (conn) => {
    const cancel_reason = normalizeStr(reason);
    if (!cancel_reason) throw new HttpError(400, "reason is required");

    const [h] = await conn.query(
      `SELECT * FROM purchase_bills WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const bill = h[0];
    if (bill.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");

    // ถ้ามี GRN APPROVED ผูก bill นี้แล้ว ไม่ให้ cancel เพื่อกันเลข/เอกสารเพี้ยน
    const [[grnCnt]] = await conn.query(
      `
      SELECT COUNT(*) AS c
      FROM goods_receipts
      WHERE company_id=:companyId AND bill_id=:id AND status='APPROVED'
      `,
      { companyId, id },
    );
    if (Number(grnCnt?.c ?? 0) > 0) {
      throw new HttpError(
        400,
        "Cannot cancel BILL: already received (GRN approved exists)",
      );
    }

    await conn.query(
      `
      UPDATE purchase_bills
      SET status='CANCELLED',
          cancelled_by=:userId,
          cancelled_at=NOW(),
          cancel_reason=:reason
      WHERE id=:id AND company_id=:companyId
      `,
      { id, companyId, userId, reason: cancel_reason },
    );

    return { ok: true };
  });
}

export async function listBill(companyId, opts = {}) {
  const q = (opts.q ?? "").toString().trim();
  const status = (opts.status ?? "").toString().trim().toUpperCase();
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(opts.pageSize ?? 20) || 20),
  );
  const offset = (page - 1) * pageSize;
  const needle = `%${q}%`;

  const where = `
    b.company_id = :companyId
    AND (:status = '' OR b.status = :status)
    AND (
      :q = '' OR
      b.bill_no LIKE :needle OR
      b.tax_invoice_no LIKE :needle OR
      v.name LIKE :needle OR
      w.name LIKE :needle
    )
  `;

  const [cntRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM purchase_bills b
    JOIN vendors v ON v.id = b.vendor_id AND v.company_id = b.company_id
    JOIN warehouses w ON w.id = b.warehouse_id AND w.company_id = b.company_id
    WHERE ${where}
    `,
    { companyId, q, needle, status },
  );

  const total = Number(cntRows?.[0]?.total ?? 0);

  const [rows] = await pool.query(
    `
    SELECT
      b.id,
      b.company_id,
      b.bill_no,
      b.tax_invoice_no,
      b.po_id,
      b.is_manual,
      b.status,
      b.issue_date,
      b.note,
      b.paid_date,
      b.created_at,
      b.updated_at,
      b.vendor_id,
      v.name AS vendor_name,
      b.warehouse_id,
      w.name AS warehouse_name,
      COALESCE(b.extra_charge_amt, 0) AS extra_charge_amt,
      (SELECT COUNT(*) FROM purchase_bill_items i WHERE i.purchase_bill_id = b.id) AS item_count,

      (
        (
          (
            SELECT COALESCE(SUM(
              GREATEST(
                0,
                (i.qty * i.unit_cost)
                - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
                - i.discount_amt
              )
            ), 0)
            FROM purchase_bill_items i
            WHERE i.purchase_bill_id = b.id
          )
          + COALESCE(b.extra_charge_amt,0)
        )
        -
        CASE
          WHEN UPPER(TRIM(COALESCE(b.header_discount_type,'')))='PERCENT'
            THEN (
              (
                (
                  SELECT COALESCE(SUM(
                    GREATEST(
                      0,
                      (i.qty * i.unit_cost)
                      - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
                      - i.discount_amt
                    )
                  ), 0)
                  FROM purchase_bill_items i
                  WHERE i.purchase_bill_id = b.id
                )
                + COALESCE(b.extra_charge_amt,0)
              )
              * (COALESCE(b.header_discount_value,0) / 100)
            )
          ELSE COALESCE(b.header_discount_value,0)
        END
      ) AS total_amount

    FROM purchase_bills b
    JOIN vendors v ON v.id = b.vendor_id AND v.company_id = b.company_id
    JOIN warehouses w ON w.id = b.warehouse_id AND w.company_id = b.company_id
    WHERE ${where}
    ORDER BY b.id DESC
    LIMIT :limit OFFSET :offset
    `,
    { companyId, q, needle, status, limit: pageSize, offset },
  );

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}


// =========================
// GRN (รองรับ legacy + bill-based + partial receive)
// =========================
export async function createGrn(companyId, userId, data) {
  return await withTx(async (conn) => {
    const issue_date = normalizeDateStr(data?.issue_date);
    if (!issue_date) throw new HttpError(400, "issue_date is required");

    const bill_id = data?.bill_id
      ? ensurePositiveInt(data.bill_id, "bill_id")
      : null;

    // ---------- 1) Determine header context ----------
    let vendor_id = null;
    let warehouse_id = null;
    let po_id = null;
    let note = normalizeStr(data?.note);

    const extra_charge_amt = ensureNonNeg(
      data?.extra_charge_amt ?? 0,
      "extra_charge_amt",
    );
    const extra_charge_note = normalizeStr(data?.extra_charge_note);

    const header_discount_type = normalizeHeaderDiscountType(
      data?.header_discount_type,
    );
    const header_discount_value = ensureHeaderDiscountValue(
      header_discount_type,
      data?.header_discount_value,
    );

    let bill = null;
    let billItems = null;
    let receivedMap = null;

    if (bill_id) {
      // bill-based (recommended)
      bill = await loadBillForGrn(conn, companyId, bill_id);

      if (bill.status !== "APPROVED") {
        throw new HttpError(400, "BILL must be APPROVED before creating GRN");
      }

      vendor_id = ensurePositiveInt(bill.vendor_id, "vendor_id");
      warehouse_id = ensurePositiveInt(bill.warehouse_id, "warehouse_id");
      po_id = bill.po_id ? ensurePositiveInt(bill.po_id, "po_id") : null;

      billItems = await loadBillItemsForGrn(conn, bill_id);
      receivedMap = await getApprovedReceivedQtyByBillItems(
        conn,
        companyId,
        bill_id,
      );
    } else {
      // legacy mode (ต้องส่ง vendor_id/warehouse_id)
      vendor_id = ensurePositiveInt(data?.vendor_id, "vendor_id");
      warehouse_id = ensurePositiveInt(data?.warehouse_id, "warehouse_id");
      po_id = data?.po_id ? ensurePositiveInt(data.po_id, "po_id") : null;
    }

    // ---------- 2) Items ----------
    let items = null;

    if (bill_id) {
      // ถ้าไม่ส่ง items มา: auto create "remaining" lines จาก bill ทั้งหมด
      if (
        !data?.items ||
        !Array.isArray(data.items) ||
        data.items.length === 0
      ) {
        const out = [];
        for (const bi of billItems) {
          const biId = Number(bi.id);
          const ordered = Number(bi.qty);
          const received = Number(receivedMap.get(biId) ?? 0);
          const remaining = Math.max(0, ordered - received);
          if (remaining > 0) {
            out.push({
              bill_item_id: biId,
              product_id: Number(bi.product_id),
              qty: remaining,
              unit_cost: Number(bi.unit_cost ?? 0),
              // Default logic for remaining items from bill (inherit financials)
              discount_pct: Number(bi.discount_pct ?? 0),
              discount_amt: Number(bi.discount_amt ?? 0),
              tax_type: normalizeTaxType(bi.tax_type),
            });
          }
        }
        if (out.length === 0)
          throw new HttpError(400, "No remaining qty to receive for this BILL");
        items = validateGrnItems(out);
      } else {
        items = validateGrnItems(data.items);

        // Validate: bill_item_id ต้องอยู่ใน bill นี้ และ qty ห้ามเกิน remaining
        const billItemById = new Map();
        for (const bi of billItems) billItemById.set(Number(bi.id), bi);

        for (const it of items) {
          if (!it.bill_item_id) {
            throw new HttpError(
              400,
              "bill_item_id is required when bill_id is provided",
            );
          }

          const bi = billItemById.get(Number(it.bill_item_id));
          if (!bi)
            throw new HttpError(
              400,
              `bill_item_id ${it.bill_item_id} not found in this BILL`,
            );

          // ต้อง match product_id เพื่อกันยิงมั่ว
          if (Number(bi.product_id) !== Number(it.product_id)) {
            throw new HttpError(
              400,
              `product_id mismatch for bill_item_id ${it.bill_item_id}`,
            );
          }

          const ordered = Number(bi.qty);
          const received = Number(
            receivedMap.get(Number(it.bill_item_id)) ?? 0,
          );
          const remaining = Math.max(0, ordered - received);

          if (Number(it.qty) > remaining) {
            throw new HttpError(
              400,
              `Receive qty exceeds remaining for bill_item_id ${it.bill_item_id} (remaining ${remaining})`,
            );
          }
        }
      }
    } else {
      // legacy: รับ items แบบเดิม (ไม่บังคับ bill_item_id)
      items = validateGrnItems(data?.items); // ใช้ตัวนี้ได้เลย (bill_item_id จะเป็น null)
    }

    // ---------- 3) Doc no ----------
    let grnNo = normalizeDocNo(data?.grn_no);
    let isManual = 1;

    if (!grnNo) {
      grnNo = await generateDocNo(conn, companyId, "GRN", issue_date);
      isManual = 0;
    } else {
      const re = await assertManualAllowed(conn, companyId, "GRN");
      if (re && !re.test(grnNo))
        throw new HttpError(400, "Invalid GRN number format");
    }

    // ---------- 4) Insert GRN header ----------
    let grnId;
    try {
      const [r] = await conn.query(
        `
        INSERT INTO goods_receipts
          (
            company_id,
            grn_no,
            bill_id,
            po_id,
            vendor_id,
            warehouse_id,
            status,
            issue_date,
            note,
            created_by,
            is_manual,
            extra_charge_amt,
            extra_charge_note,
            header_discount_type,
            header_discount_value
          )
        VALUES
          (
            :company_id,
            :grn_no,
            :bill_id,
            :po_id,
            :vendor_id,
            :warehouse_id,
            'DRAFT',
            :issue_date,
            :note,
            :created_by,
            :is_manual,
            :extra_charge_amt,
            :extra_charge_note,
            :header_discount_type,
            :header_discount_value
          )
        `,
        {
          company_id: companyId,
          grn_no: grnNo,
          bill_id,
          po_id,
          vendor_id,
          warehouse_id,
          issue_date,
          note,
          created_by: userId,
          is_manual: isManual,
          extra_charge_amt,
          extra_charge_note,
          header_discount_type,
          header_discount_value,
        },
      );
      grnId = r.insertId;
    } catch (e) {
      if (isDupErr(e)) throw wrapDupAsHttp(e, "GRN");
      throw e;
    }

    // ---------- 5) Insert GRN items ----------
    for (const it of items) {
      await conn.query(
        `
        INSERT INTO goods_receipt_items
          (goods_receipt_id, bill_item_id, product_id, qty, unit_cost, discount_pct, discount_amt, tax_type, manual_vat)
        VALUES
          (:goods_receipt_id, :bill_item_id, :product_id, :qty, :unit_cost, :discount_pct, :discount_amt, :tax_type, :manual_vat)
        `,
        {
          goods_receipt_id: grnId,
          bill_item_id: it.bill_item_id ?? null,
          product_id: it.product_id,
          qty: it.qty,
          unit_cost: it.unit_cost ?? 0,
          discount_pct: it.discount_pct ?? 0,
          discount_amt: it.discount_amt ?? 0,
          tax_type: it.tax_type ?? "EXCLUDE_VAT_7",
          manual_vat: it.manual_vat ?? null,
        },
      );
    }

    return { id: grnId, grn_no: grnNo };
  });
}

export async function getGrn(companyId, id) {
  const [h] = await pool.query(
    `SELECT * FROM goods_receipts WHERE id=:id AND company_id=:companyId LIMIT 1`,
    { id, companyId },
  );
  if (h.length === 0) throw new HttpError(404, "Not found");

  const [items] = await pool.query(
    `
    SELECT
      i.id,
      i.bill_item_id,
      i.product_id,
      p.code,
      p.name,
      i.qty,
      i.unit_cost,
      i.discount_pct,
      i.discount_amt,
      i.tax_type,
      i.manual_vat
    FROM goods_receipt_items i
    JOIN products p ON p.id=i.product_id
    WHERE i.goods_receipt_id=:id
    ORDER BY i.id ASC
    `,
    { id },
  );

  return { header: h[0], items };
}

export async function approveGrn(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM goods_receipts WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const grn = h[0];
    if (grn.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");
    if (grn.status !== "DRAFT") throw new HttpError(400, "Invalid status");

    const whId = grn.warehouse_id;
    const issueDate = grn.issue_date;
    const bill_id = grn.bill_id ? Number(grn.bill_id) : null;

    // lock items
    const [items] = await conn.query(
      `
      SELECT id, bill_item_id, product_id, qty, unit_cost
      FROM goods_receipt_items
      WHERE goods_receipt_id=:id
      ORDER BY id ASC
      FOR UPDATE
      `,
      { id },
    );
    if (items.length === 0) throw new HttpError(400, "No items");

    // ถ้าเป็น bill-based: re-check remaining (กัน race)
    if (bill_id) {
      const bill = await loadBillForGrn(conn, companyId, bill_id);
      if (bill.status !== "APPROVED") {
        throw new HttpError(400, "BILL must be APPROVED to approve GRN");
      }

      const billItems = await loadBillItemsForGrn(conn, bill_id);
      const billItemById = new Map();
      for (const bi of billItems) billItemById.set(Number(bi.id), bi);

      const receivedMap = await getApprovedReceivedQtyByBillItems(
        conn,
        companyId,
        bill_id,
      );

      for (const it of items) {
        if (!it.bill_item_id) {
          throw new HttpError(
            400,
            "bill_item_id missing on GRN item for bill-based GRN",
          );
        }
        const bi = billItemById.get(Number(it.bill_item_id));
        if (!bi)
          throw new HttpError(
            400,
            `bill_item_id ${it.bill_item_id} not found in BILL`,
          );

        if (Number(bi.product_id) !== Number(it.product_id)) {
          throw new HttpError(
            400,
            `product_id mismatch for bill_item_id ${it.bill_item_id}`,
          );
        }

        const ordered = Number(bi.qty);
        const already = Number(receivedMap.get(Number(it.bill_item_id)) ?? 0);
        const remaining = Math.max(0, ordered - already);

        if (Number(it.qty) > remaining) {
          throw new HttpError(
            400,
            `Receive qty exceeds remaining for bill_item_id ${it.bill_item_id} (remaining ${remaining})`,
          );
        }
      }
    }

    // stock posting
    for (const it of items) {
      const qty = Number(it.qty);

      await conn.query(
        `
        INSERT INTO product_stock (product_id, warehouse_id, company_id, qty)
        VALUES (:product_id, :warehouse_id, :company_id, :qty)
        ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)
        `,
        {
          product_id: it.product_id,
          warehouse_id: whId,
          company_id: companyId,
          qty,
        },
      );

      await conn.query(
        `
        INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
        VALUES (:company_id, 'GRN', :ref_id, :product_id, :warehouse_id, 'IN', :qty, NULL, :created_by)
        `,
        {
          company_id: companyId,
          ref_id: id,
          product_id: it.product_id,
          warehouse_id: whId,
          qty,
          created_by: userId,
        },
      );

      const [lotIns] = await conn.query(
        `
        INSERT INTO stock_lots (company_id, product_id, warehouse_id, ref_type, ref_id, received_date, unit_cost, qty_in, qty_out)
        VALUES (:company_id, :product_id, :warehouse_id, 'GRN', :ref_id, :received_date, :unit_cost, :qty_in, 0)
        `,
        {
          company_id: companyId,
          product_id: it.product_id,
          warehouse_id: whId,
          ref_id: id,
          received_date: issueDate,
          unit_cost: it.unit_cost,
          qty_in: qty,
        },
      );

      const lotId = lotIns.insertId;

      await conn.query(
        `
        INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
        VALUES (:company_id, :lot_id, 'GRN', :ref_id, :qty, :unit_cost)
        `,
        {
          company_id: companyId,
          lot_id: lotId,
          ref_id: id,
          qty,
          unit_cost: it.unit_cost,
        },
      );
    }

    await conn.query(
      `UPDATE goods_receipts SET status='APPROVED', approved_by=:approved_by, approved_at=NOW() WHERE id=:id`,
      { approved_by: userId, id },
    );

    return { ok: true };
  });
}


export async function cancelGrn(companyId, userId, id, reason) {
  return await withTx(async (conn) => {
    const cancel_reason = normalizeStr(reason);
    if (!cancel_reason) throw new HttpError(400, "reason is required");

    const [h] = await conn.query(
      `SELECT * FROM goods_receipts WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const grn = h[0];
    if (grn.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");

    if (grn.status === "DRAFT") {
      await conn.query(
        `
        UPDATE goods_receipts
        SET status='CANCELLED',
            cancelled_by=:userId,
            cancelled_at=NOW(),
            cancel_stage='DRAFT',
            cancel_reason=:reason
        WHERE id=:id AND company_id=:companyId
        `,
        { id, companyId, userId, reason: cancel_reason },
      );
      return { ok: true, stage: "DRAFT" };
    }

    if (grn.status !== "APPROVED") throw new HttpError(400, "Invalid status");

    const whId = grn.warehouse_id;

    const [lots] = await conn.query(
      `
      SELECT id AS lot_id, product_id, warehouse_id, qty_in, qty_out, unit_cost
      FROM stock_lots
      WHERE company_id=:companyId AND ref_type='GRN' AND ref_id=:refId
      ORDER BY id ASC
      FOR UPDATE
      `,
      { companyId, refId: id },
    );
    if (lots.length === 0)
      throw new HttpError(500, "Missing stock lots for this GRN");

    for (const lot of lots) {
      if (Number(lot.qty_out) > 0) {
        throw new HttpError(
          400,
          "Cannot cancel: some items already consumed/sold",
        );
      }
    }

    for (const lot of lots) {
      const qty = Number(lot.qty_in);

      await conn.query(
        `
        UPDATE product_stock
        SET qty = qty - :qty
        WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
        `,
        {
          qty,
          companyId,
          productId: lot.product_id,
          warehouseId: lot.warehouse_id ?? whId,
        },
      );

      await conn.query(
        `
        INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
        VALUES (:company_id, 'GRN_CANCEL', :ref_id, :product_id, :warehouse_id, 'OUT', :qty, :note, :created_by)
        `,
        {
          company_id: companyId,
          ref_id: id,
          product_id: lot.product_id,
          warehouse_id: lot.warehouse_id ?? whId,
          qty,
          note: cancel_reason,
          created_by: userId,
        },
      );
    }

    await conn.query(
      `
      UPDATE goods_receipts
      SET status='CANCELLED',
          cancelled_by=:userId,
          cancelled_at=NOW(),
          cancel_stage='APPROVED',
          cancel_reason=:reason
      WHERE id=:id AND company_id=:companyId
      `,
      { id, companyId, userId, reason: cancel_reason },
    );

    return { ok: true, stage: "APPROVED" };
  });
}

export async function listGrn(companyId, opts = {}) {
  const q = (opts.q ?? "").toString().trim();
  const status = (opts.status ?? "").toString().trim().toUpperCase();
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(opts.pageSize ?? 20) || 20),
  );
  const offset = (page - 1) * pageSize;
  const needle = `%${q}%`;

  const where = `
    g.company_id = :companyId
    AND (:status = '' OR g.status = :status)
    AND (
      :q = '' OR
      g.grn_no LIKE :needle OR
      v.name LIKE :needle OR
      w.name LIKE :needle OR
      COALESCE(b.bill_no,'') LIKE :needle OR
      COALESCE(b.tax_invoice_no,'') LIKE :needle
    )
  `;

  const [cntRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM goods_receipts g
    JOIN vendors v ON v.id = g.vendor_id AND v.company_id = g.company_id
    JOIN warehouses w ON w.id = g.warehouse_id AND w.company_id = g.company_id
    LEFT JOIN purchase_bills b ON b.id = g.bill_id AND b.company_id = g.company_id
    WHERE ${where}
    `,
    { companyId, q, needle, status },
  );

  const total = Number(cntRows?.[0]?.total ?? 0);

  const [rows] = await pool.query(
    `
    SELECT
      g.id,
      g.company_id,
      g.grn_no,
      g.is_manual,
      g.bill_id,
      b.bill_no,
      b.tax_invoice_no,
      g.po_id,
      g.status,
      g.issue_date,
      g.note,
      g.created_at,
      g.updated_at,
      g.vendor_id,
      v.name AS vendor_name,
      g.warehouse_id,
      w.name AS warehouse_name,
      (SELECT COUNT(*) FROM goods_receipt_items i WHERE i.goods_receipt_id = g.id) AS item_count,
      (SELECT COALESCE(SUM(i.qty * i.unit_cost), 0) FROM goods_receipt_items i WHERE i.goods_receipt_id = g.id) AS total_amount
    FROM goods_receipts g
    JOIN vendors v ON v.id = g.vendor_id AND v.company_id = g.company_id
    JOIN warehouses w ON w.id = g.warehouse_id AND w.company_id = g.company_id
    LEFT JOIN purchase_bills b ON b.id = g.bill_id AND b.company_id = g.company_id
    WHERE ${where}
    ORDER BY g.id DESC
    LIMIT :limit OFFSET :offset
    `,
    { companyId, q, needle, status, limit: pageSize, offset },
  );

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

// =========================
// PO
// =========================
export async function createPo(companyId, userId, data) {
  return await withTx(async (conn) => {
    /* ==============================
       1. VALIDATION
    ============================== */

    const issue_date = normalizeDateStr(data?.issue_date);
    if (!issue_date) throw new HttpError(400, "issue_date is required");

    const vendor_id = ensurePositiveInt(data?.vendor_id, "vendor_id");
    const warehouse_id = ensurePositiveInt(data?.warehouse_id, "warehouse_id");

    const expected_date = data?.expected_date
      ? normalizeDateStr(data.expected_date)
      : null;

    const note = normalizeStr(data?.note);

    const extra_charge_amt = ensureNonNeg(
      data?.extra_charge_amt ?? 0,
      "extra_charge_amt"
    );

    const extra_charge_note = normalizeStr(data?.extra_charge_note);

    const header_discount_type =
      data?.header_discount_type === "PERCENT" ||
      data?.header_discount_type === "AMOUNT"
        ? data.header_discount_type
        : "AMOUNT";

    const header_discount_value = ensureNonNeg(
      data?.header_discount_value ?? 0,
      "header_discount_value"
    );

    const items = validateItems(data?.items);
    if (!items.length)
      throw new HttpError(400, "PO must have at least 1 item");

    const vendor_person_id = data?.vendor_person_id
      ? ensurePositiveInt(data.vendor_person_id, "vendor_person_id")
      : null;

    /* ==============================
       2. CHECK MASTER DATA
    ============================== */

    const [[vendor]] = await conn.query(
      `
      SELECT id, code, name
      FROM vendors
      WHERE id=:vendor_id AND company_id=:companyId
      LIMIT 1
      `,
      { vendor_id, companyId }
    );

    if (!vendor) throw new HttpError(404, "Vendor not found");

    const [[warehouse]] = await conn.query(
      `
      SELECT id
      FROM warehouses
      WHERE id=:warehouse_id AND company_id=:companyId
      LIMIT 1
      `,
      { warehouse_id, companyId }
    );

    if (!warehouse) throw new HttpError(404, "Warehouse not found");

    /* ==============================
       3. LOAD VENDOR PERSON SNAPSHOT
    ============================== */

    const person = await loadVendorPersonOrPrimary(
      conn,
      companyId,
      vendor_id,
      vendor_person_id
    );

    /* ==============================
       4. LOAD ADDRESS SNAPSHOT
    ============================== */

    const [addrRows] = await conn.query(
      `
      SELECT addr_type, contact_name, address_line, subdistrict, district, province, postcode
      FROM vendor_addresses
      WHERE vendor_id=:vendor_id
      `,
      { vendor_id }
    );

    let shipping = null;
    let registered = null;

    for (const a of addrRows) {
      if (a.addr_type === "shipping") shipping = a;
      if (a.addr_type === "registered") registered = a;
    }

    /* ==============================
       5. DOC NUMBER
    ============================== */

    let poNo = normalizeDocNo(data?.po_no);
    let isManual = 1;

    if (!poNo) {
      poNo = await generateDocNo(conn, companyId, "PO", issue_date);
      isManual = 0;
    } else {
      const re = await assertManualAllowed(conn, companyId, "PO");
      if (re && !re.test(poNo))
        throw new HttpError(400, "Invalid PO number format");
    }

    /* ==============================
       6. INSERT PO HEADER
    ============================== */

    let poId;

    try {
      const [r] = await conn.query(
        `
        INSERT INTO purchase_orders
        (
          company_id,
          po_no,
          vendor_id,

          vendor_person_id,
          vendor_person_prefix,
          vendor_person_first_name,
          vendor_person_last_name,
          vendor_person_nickname,
          vendor_person_email,
          vendor_person_phone,
          vendor_person_position,
          vendor_person_department,

          vendor_shipping_contact_name,
          vendor_shipping_address_line,
          vendor_shipping_subdistrict,
          vendor_shipping_district,
          vendor_shipping_province,
          vendor_shipping_postcode,

          vendor_registered_contact_name,
          vendor_registered_address_line,
          vendor_registered_subdistrict,
          vendor_registered_district,
          vendor_registered_province,
          vendor_registered_postcode,

          extra_charge_amt,
          extra_charge_note,
          header_discount_type,
          header_discount_value,

          warehouse_id,
          status,
          issue_date,
          expected_date,
          note,
          created_by,
          is_manual
        )
        VALUES
        (
          :company_id,
          :po_no,
          :vendor_id,

          :vendor_person_id,
          :vendor_person_prefix,
          :vendor_person_first_name,
          :vendor_person_last_name,
          :vendor_person_nickname,
          :vendor_person_email,
          :vendor_person_phone,
          :vendor_person_position,
          :vendor_person_department,

          :shipping_contact_name,
          :shipping_address_line,
          :shipping_subdistrict,
          :shipping_district,
          :shipping_province,
          :shipping_postcode,

          :registered_contact_name,
          :registered_address_line,
          :registered_subdistrict,
          :registered_district,
          :registered_province,
          :registered_postcode,

          :extra_charge_amt,
          :extra_charge_note,
          :header_discount_type,
          :header_discount_value,

          :warehouse_id,
          'DRAFT',
          :issue_date,
          :expected_date,
          :note,
          :created_by,
          :is_manual
        )
        `,
        {
          company_id: companyId,
          po_no: poNo,
          vendor_id,

          vendor_person_id: person?.id ?? null,
          vendor_person_prefix: person?.prefix ?? null,
          vendor_person_first_name: person?.first_name ?? null,
          vendor_person_last_name: person?.last_name ?? null,
          vendor_person_nickname: person?.nickname ?? null,
          vendor_person_email: person?.email ?? null,
          vendor_person_phone: person?.phone ?? null,
          vendor_person_position: person?.position ?? null,
          vendor_person_department: person?.department ?? null,

          shipping_contact_name: shipping?.contact_name ?? null,
          shipping_address_line: shipping?.address_line ?? null,
          shipping_subdistrict: shipping?.subdistrict ?? null,
          shipping_district: shipping?.district ?? null,
          shipping_province: shipping?.province ?? null,
          shipping_postcode: shipping?.postcode ?? null,

          registered_contact_name: registered?.contact_name ?? null,
          registered_address_line: registered?.address_line ?? null,
          registered_subdistrict: registered?.subdistrict ?? null,
          registered_district: registered?.district ?? null,
          registered_province: registered?.province ?? null,
          registered_postcode: registered?.postcode ?? null,

          extra_charge_amt,
          extra_charge_note,
          header_discount_type,
          header_discount_value,

          warehouse_id,
          issue_date,
          expected_date,
          note,
          created_by: userId,
          is_manual: isManual
        }
      );

      poId = r.insertId;
    } catch (e) {
      if (isDupErr(e)) throw wrapDupAsHttp(e, "PO");
      throw e;
    }

    /* ==============================
       7. INSERT ITEMS
    ============================== */

    for (const it of items) {
      await conn.query(
        `
        INSERT INTO purchase_order_items
        (purchase_order_id, product_id, qty, unit_cost, discount_pct, discount_amt, tax_type, manual_vat)
        VALUES
        (:purchase_order_id, :product_id, :qty, :unit_cost, :discount_pct, :discount_amt, :tax_type, :manual_vat)
        `,
        {
          purchase_order_id: poId,
          product_id: it.product_id,
          qty: it.qty,
          unit_cost: it.unit_cost ?? 0,
          discount_pct: it.discount_pct ?? 0,
          discount_amt: it.discount_amt ?? 0,
          tax_type: it.tax_type ?? "EXCLUDE_VAT_7",
          manual_vat: it.manual_vat ?? null
        }
      );
    }

    return { id: poId, po_no: poNo };
  });
}



export async function getPo(companyId, id) {
  const [h] = await pool.query(
    `
    SELECT
      p.*,

      v.name AS vendor_name,
      v.tax_id AS vendor_tax_id,
      v.address AS vendor_address,
      v.phone AS vendor_phone,
      v.email AS vendor_email,

      w.name AS warehouse_name,
      w.location AS warehouse_location,
      w.description AS warehouse_description

    FROM purchase_orders p
    JOIN vendors v 
      ON v.id = p.vendor_id 
      AND v.company_id = p.company_id

    JOIN warehouses w 
      ON w.id = p.warehouse_id 
      AND w.company_id = p.company_id

    WHERE p.id=:id 
      AND p.company_id=:companyId
    LIMIT 1
    `,
    { id, companyId }
  );

  if (h.length === 0) throw new HttpError(404, "Not found");

  const [items] = await pool.query(
    `
    SELECT
      i.id,
      i.product_id,
      p.code,
      p.name,
      i.qty,
      i.unit_cost,
      i.discount_pct,
      i.discount_amt,
      i.tax_type,
      i.manual_vat,
      GREATEST(
        0,
        (i.qty * i.unit_cost)
        - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
        - i.discount_amt
      ) AS line_net
    FROM purchase_order_items i
    JOIN products p ON p.id=i.product_id
    WHERE i.purchase_order_id=:id
    ORDER BY i.id ASC
    `,
    { id }
  );

  return { header: h[0], items };
}



export async function approvePo(companyId, userId, id) {
  return await withTx(async (conn) => {
    const [h] = await conn.query(
      `SELECT * FROM purchase_orders WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const po = h[0];
    if (po.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");
    if (po.status !== "DRAFT") throw new HttpError(400, "Invalid status");

    const [items] = await conn.query(
      `
      SELECT id
      FROM purchase_order_items
      WHERE purchase_order_id=:id
      ORDER BY id ASC
      FOR UPDATE
      `,
      { id },
    );
    if (items.length === 0) throw new HttpError(400, "No items");

    await conn.query(
      `UPDATE purchase_orders SET status='APPROVED', approved_by=:approved_by, approved_at=NOW() WHERE id=:id`,
      { approved_by: userId, id },
    );

    return { ok: true };
  });
}

export async function cancelPo(companyId, userId, id, reason) {
  return await withTx(async (conn) => {
    const cancel_reason = normalizeStr(reason);
    if (!cancel_reason) throw new HttpError(400, "reason is required");

    const [h] = await conn.query(
      `SELECT * FROM purchase_orders WHERE id=:id AND company_id=:companyId LIMIT 1 FOR UPDATE`,
      { id, companyId },
    );
    if (h.length === 0) throw new HttpError(404, "Not found");

    const po = h[0];
    if (po.status === "CANCELLED")
      throw new HttpError(400, "Already cancelled");

    await conn.query(
      `
      UPDATE purchase_orders
      SET status='CANCELLED',
          cancelled_by=:userId,
          cancelled_at=NOW(),
          cancel_reason=:reason
      WHERE id=:id AND company_id=:companyId
      `,
      { id, companyId, userId, reason: cancel_reason },
    );

    return { ok: true };
  });
}

export async function listPo(companyId, opts = {}) {
  const q = (opts.q ?? "").toString().trim();
  const status = (opts.status ?? "").toString().trim().toUpperCase();
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(opts.pageSize ?? 20) || 20),
  );
  const offset = (page - 1) * pageSize;
  const needle = `%${q}%`;

  const where = `
    p.company_id = :companyId
    AND (:status = '' OR p.status = :status)
    AND (
      :q = '' OR
      p.po_no LIKE :needle OR
      v.name LIKE :needle OR
      w.name LIKE :needle
    )
  `;

  const [cntRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM purchase_orders p
    JOIN vendors v ON v.id = p.vendor_id AND v.company_id = p.company_id
    JOIN warehouses w ON w.id = p.warehouse_id AND w.company_id = p.company_id
    WHERE ${where}
    `,
    { companyId, q, needle, status },
  );

  const total = Number(cntRows?.[0]?.total ?? 0);

  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.company_id,
      p.po_no,
      p.is_manual,
      p.status,
      p.issue_date,
      p.expected_date,
      p.created_at,
      p.updated_at,
      p.vendor_id,
      v.name AS vendor_name,
      p.warehouse_id,
      w.name AS warehouse_name,

      COALESCE(p.extra_charge_amt, 0) AS extra_charge_amt,

      (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = p.id) AS item_count,

(
  (
    (
      SELECT COALESCE(SUM(
        GREATEST(
          0,
          (i.qty * i.unit_cost)
          - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
          - i.discount_amt
        )
      ), 0)
      FROM purchase_order_items i
      WHERE i.purchase_order_id = p.id
    )
    + COALESCE(p.extra_charge_amt,0)
  )
  -
  CASE
    WHEN p.header_discount_type='PERCENT'
      THEN (
        (
          (
            SELECT COALESCE(SUM(
              GREATEST(
                0,
                (i.qty * i.unit_cost)
                - ((i.qty * i.unit_cost) * (i.discount_pct / 100))
                - i.discount_amt
              )
            ), 0)
            FROM purchase_order_items i
            WHERE i.purchase_order_id = p.id
          )
          + COALESCE(p.extra_charge_amt,0)
        )
        * (COALESCE(p.header_discount_value,0) / 100)
      )
    ELSE COALESCE(p.header_discount_value,0)
  END
) AS total_amount


    FROM purchase_orders p
    JOIN vendors v ON v.id = p.vendor_id AND v.company_id = p.company_id
    JOIN warehouses w ON w.id = p.warehouse_id AND w.company_id = p.company_id
    WHERE ${where}
    ORDER BY p.id DESC
    LIMIT :limit OFFSET :offset
    `,
    { companyId, q, needle, status, limit: pageSize, offset },
  );

  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}
