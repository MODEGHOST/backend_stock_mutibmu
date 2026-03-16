// vendor.service.js
import { pool } from "../config/db.js";
import HttpError from "../utils/httpError.js";

async function ensureCodeUnique(companyId, code, excludeId = null) {
  const [rows] = await pool.query(
    `SELECT id FROM vendors
     WHERE company_id=:companyId AND code=:code
       AND (:excludeId IS NULL OR id <> :excludeId)
     LIMIT 1`,
    { companyId, code, excludeId }
  );
  if (rows.length > 0) throw new HttpError(400, "Vendor code already exists");
}

// --- helpers: enforce only one primary/default ---
function enforceSingleFlag(list, flagKey) {
  const arr = (list || []).slice(0, 5).map((x) => ({ ...x }));
  let found = false;
  for (let i = 0; i < arr.length; i++) {
    const v = Number(arr[i][flagKey] ?? 0) ? 1 : 0;
    if (v === 1 && !found) {
      arr[i][flagKey] = 1;
      found = true;
    } else {
      arr[i][flagKey] = 0;
    }
  }
  // ถ้ายังไม่มีเลย แต่มีรายการ -> ตั้งตัวแรกเป็นหลัก
  if (!found && arr.length) arr[0][flagKey] = 1;
  return arr;
}

function normalizeContacts(list = []) {
  const arr = (list || []).slice(0, 5).map((c, i) => ({
    label: c.label ?? null,
    channel: c.channel,
    value: c.value,
    is_primary: Number(c.is_primary ?? 0) ? 1 : 0,
    sort_order: Number(c.sort_order ?? i),
  }));
  return enforceSingleFlag(arr, "is_primary");
}

function normalizeBanks(list = []) {
  const arr = (list || []).slice(0, 5).map((b, i) => ({
    bank_code: b.bank_code ?? null,
    bank_name: b.bank_name,
    account_name: b.account_name,
    account_no: b.account_no,
    branch_code: b.branch_code ?? null,
    is_default: Number(b.is_default ?? 0) ? 1 : 0,
    sort_order: Number(b.sort_order ?? i),
  }));
  return enforceSingleFlag(arr, "is_default");
}

function normalizePeople(list = []) {
  const arr = (list || []).slice(0, 5).map((p, i) => ({
    prefix: p.prefix ?? null,
    first_name: p.first_name,
    last_name: p.last_name ?? null,
    nickname: p.nickname ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    position: p.position ?? null,
    department: p.department ?? null,
    is_primary: Number(p.is_primary ?? 0) ? 1 : 0,
    sort_order: Number(p.sort_order ?? i),
  }));
  return enforceSingleFlag(arr, "is_primary");
}

// ✅ รองรับ 3 แบบ + map ไป DB columns payment_month_day
function normalizePaymentTerm(payment_term) {
  const t = payment_term?.type ?? "by_days";

  if (t === "by_month_day") {
    const md = Number(payment_term?.month_day ?? 1);
    return {
      payment_term_type: "by_month_day",
      payment_due_days: 0,
      payment_due_date: null,
      payment_month_day: Math.min(31, Math.max(1, md)),
    };
  }

  if (t === "by_date") {
    return {
      payment_term_type: "by_date",
      payment_due_days: 0,
      payment_due_date: payment_term?.due_date ?? null,
      payment_month_day: null,
    };
  }

  // default by_days
  return {
    payment_term_type: "by_days",
    payment_due_days: Number(payment_term?.due_days ?? 0),
    payment_due_date: null,
    payment_month_day: null,
  };
}

function normalizeAddress(addr) {
  if (!addr) return null;
  return {
    contact_name: addr.contact_name ?? null,
    phone: addr.phone ?? null,
    address_line: addr.address_line ?? null,
    subdistrict: addr.subdistrict ?? null,
    district: addr.district ?? null,
    province: addr.province ?? null,
    postcode: addr.postcode ?? null,
    country: addr.country ?? "TH",
  };
}

export async function listVendors(companyId) {
  const [rows] = await pool.query(
    `SELECT id, company_id, type, code, name, tax_id, tax_country,
            office_type, legal_entity_type, legal_form, business_name,
            person_first_name, person_last_name,
            phone, email, address,
            payment_term_type, payment_due_days, payment_due_date, payment_month_day,
            is_active, created_at, updated_at
     FROM vendors
     WHERE company_id=:companyId
     ORDER BY id DESC`,
    { companyId }
  );
  return rows;
}

export async function getVendor(companyId, id) {
  const [rows] = await pool.query(
    `SELECT id, company_id, type, code, name, tax_id, tax_country,
            office_type, legal_entity_type, legal_form, business_name,
            person_first_name, person_last_name,
            phone, email, address,
            payment_term_type, payment_due_days, payment_due_date, payment_month_day,
            is_active, created_at, updated_at
     FROM vendors
     WHERE company_id=:companyId AND id=:id
     LIMIT 1`,
    { companyId, id }
  );
  if (rows.length === 0) throw new HttpError(404, "Not found");
  const vendor = rows[0];

  const [contacts] = await pool.query(
    `SELECT id, vendor_id, label, channel, value, is_primary, sort_order, created_at, updated_at
     FROM vendor_contacts
     WHERE vendor_id=:id
     ORDER BY sort_order ASC, id ASC`,
    { id }
  );

  const [banks] = await pool.query(
    `SELECT id, vendor_id, bank_code, bank_name, account_name, account_no, branch_code, is_default, sort_order, created_at, updated_at
     FROM vendor_bank_accounts
     WHERE vendor_id=:id
     ORDER BY sort_order ASC, id ASC`,
    { id }
  );

  const [people] = await pool.query(
    `SELECT id, vendor_id, prefix, first_name, last_name, nickname, email, phone, position, department,
            is_primary, sort_order, created_at, updated_at
     FROM vendor_people
     WHERE vendor_id=:id
     ORDER BY sort_order ASC, id ASC`,
    { id }
  );

  const [addrs] = await pool.query(
    `SELECT id, vendor_id, addr_type, contact_name, address_line, subdistrict, district, province, postcode, country
     FROM vendor_addresses
     WHERE vendor_id=:id`,
    { id }
  );

  const registered_address = (addrs || []).find((a) => a.addr_type === "registered") ?? null;
  const shipping_address = (addrs || []).find((a) => a.addr_type === "shipping") ?? null;

  const [goodsRows] = await pool.query(
    `SELECT id, vendor_id, contact_name, phone, address_line, subdistrict, district, province, postcode, country
     FROM vendor_shipping_addresses
     WHERE vendor_id=:id`,
    { id }
  );
  const goods_shipping_address = goodsRows[0] ?? null;

  return {
    ...vendor,
    registered_address,
    shipping_address,
    goods_shipping_address,
    contacts,
    people,
    bank_accounts: banks,
    payment_term: {
      type: vendor.payment_term_type ?? "by_days",
      due_days: Number(vendor.payment_due_days ?? 0),
      due_date: vendor.payment_due_date ?? null,
      month_day: vendor.payment_month_day ?? null,
    },
  };
}

export async function createVendor(companyId, data) {
  await ensureCodeUnique(companyId, data.code);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_term_type, payment_due_days, payment_due_date, payment_month_day } =
      normalizePaymentTerm(data.payment_term);

    const [r] = await conn.query(
      `INSERT INTO vendors
       (company_id, code, name, type,
        tax_id, tax_country, office_type,
        legal_entity_type, legal_form, business_name,
        person_first_name, person_last_name,
        phone, email, address,
        is_active,
        payment_term_type, payment_due_days, payment_due_date, payment_month_day)
       VALUES
       (:company_id, :code, :name, :type,
        :tax_id, :tax_country, :office_type,
        :legal_entity_type, :legal_form, :business_name,
        :person_first_name, :person_last_name,
        :phone, :email, :address,
        :is_active,
        :payment_term_type, :payment_due_days, :payment_due_date, :payment_month_day)`,
      {
        company_id: companyId,
        code: data.code,
        name: data.name,
        type: data.type ?? 'VENDOR',

        tax_id: data.tax_id ?? null,
        tax_country: data.tax_country ?? "TH",
        office_type: data.office_type ?? "unknown",

        legal_entity_type: data.legal_entity_type ?? "corporate",
        legal_form: data.legal_form ?? null,
        business_name: data.business_name ?? null,
        person_first_name: data.person_first_name ?? null,
        person_last_name: data.person_last_name ?? null,

        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        is_active: data.is_active ?? 1,

        payment_term_type,
        payment_due_days,
        payment_due_date,
        payment_month_day,
      }
    );

    const vendorId = r.insertId;

    const reg = normalizeAddress(data.registered_address);
    const ship = normalizeAddress(data.shipping_address);
    const goodsShip = normalizeAddress(data.goods_shipping_address);

    if (reg) {
      await conn.query(
        `INSERT INTO vendor_addresses
         (vendor_id, addr_type, contact_name, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,'registered',:contact_name,:address_line,:subdistrict,:district,:province,:postcode,:country)
         ON DUPLICATE KEY UPDATE
           contact_name=VALUES(contact_name), address_line=VALUES(address_line),
           subdistrict=VALUES(subdistrict), district=VALUES(district), province=VALUES(province),
           postcode=VALUES(postcode), country=VALUES(country)`,
        { vendor_id: vendorId, ...reg }
      );
    }

    if (ship) {
      await conn.query(
        `INSERT INTO vendor_addresses
         (vendor_id, addr_type, contact_name, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,'shipping',:contact_name,:address_line,:subdistrict,:district,:province,:postcode,:country)
         ON DUPLICATE KEY UPDATE
           contact_name=VALUES(contact_name), address_line=VALUES(address_line),
           subdistrict=VALUES(subdistrict), district=VALUES(district), province=VALUES(province),
           postcode=VALUES(postcode), country=VALUES(country)`,
        { vendor_id: vendorId, ...ship }
      );
    }

    if (goodsShip) {
      await conn.query(
        `INSERT INTO vendor_shipping_addresses
         (vendor_id, contact_name, phone, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,:contact_name,:phone,:address_line,:subdistrict,:district,:province,:postcode,:country)`,
        { vendor_id: vendorId, ...goodsShip }
      );
    }

    for (const c of normalizeContacts(data.contacts)) {
      await conn.query(
        `INSERT INTO vendor_contacts (vendor_id, label, channel, value, is_primary, sort_order)
         VALUES (:vendor_id, :label, :channel, :value, :is_primary, :sort_order)`,
        { vendor_id: vendorId, ...c }
      );
    }

    for (const p of normalizePeople(data.people)) {
      await conn.query(
        `INSERT INTO vendor_people
         (vendor_id, prefix, first_name, last_name, nickname, email, phone, position, department, is_primary, sort_order)
         VALUES
         (:vendor_id,:prefix,:first_name,:last_name,:nickname,:email,:phone,:position,:department,:is_primary,:sort_order)`,
        { vendor_id: vendorId, ...p }
      );
    }

    for (const b of normalizeBanks(data.bank_accounts)) {
      await conn.query(
        `INSERT INTO vendor_bank_accounts
         (vendor_id, bank_code, bank_name, account_name, account_no, branch_code, is_default, sort_order)
         VALUES
         (:vendor_id,:bank_code,:bank_name,:account_name,:account_no,:branch_code,:is_default,:sort_order)`,
        { vendor_id: vendorId, ...b }
      );
    }

    await conn.commit();
    return vendorId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateVendor(companyId, id, data) {
  await ensureCodeUnique(companyId, data.code, id);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { payment_term_type, payment_due_days, payment_due_date, payment_month_day } =
      normalizePaymentTerm(data.payment_term);

    const [r] = await conn.query(
      `UPDATE vendors
       SET code=:code, name=:name, type=:type,
           tax_id=:tax_id, tax_country=:tax_country, office_type=:office_type,
           legal_entity_type=:legal_entity_type, legal_form=:legal_form, business_name=:business_name,
           person_first_name=:person_first_name, person_last_name=:person_last_name,
           phone=:phone, email=:email, address=:address,
           is_active=:is_active,
           payment_term_type=:payment_term_type, payment_due_days=:payment_due_days,
           payment_due_date=:payment_due_date, payment_month_day=:payment_month_day
       WHERE id=:id AND company_id=:companyId`,
      {
        id,
        companyId,
        code: data.code,
        name: data.name,
        type: data.type ?? 'VENDOR',

        tax_id: data.tax_id ?? null,
        tax_country: data.tax_country ?? "TH",
        office_type: data.office_type ?? "unknown",

        legal_entity_type: data.legal_entity_type ?? "corporate",
        legal_form: data.legal_form ?? null,
        business_name: data.business_name ?? null,
        person_first_name: data.person_first_name ?? null,
        person_last_name: data.person_last_name ?? null,

        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        is_active: data.is_active ?? 1,

        payment_term_type,
        payment_due_days,
        payment_due_date,
        payment_month_day,
      }
    );
    if (r.affectedRows === 0) throw new HttpError(404, "Not found");

    const reg = normalizeAddress(data.registered_address);
    const ship = normalizeAddress(data.shipping_address);
    const goodsShip = normalizeAddress(data.goods_shipping_address);

    await conn.query(`DELETE FROM vendor_addresses WHERE vendor_id=:id`, { id });
    await conn.query(`DELETE FROM vendor_shipping_addresses WHERE vendor_id=:id`, { id });

    if (reg) {
      await conn.query(
        `INSERT INTO vendor_addresses
         (vendor_id, addr_type, contact_name, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,'registered',:contact_name,:address_line,:subdistrict,:district,:province,:postcode,:country)`,
        { vendor_id: id, ...reg }
      );
    }

    if (ship) {
      await conn.query(
        `INSERT INTO vendor_addresses
         (vendor_id, addr_type, contact_name, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,'shipping',:contact_name,:address_line,:subdistrict,:district,:province,:postcode,:country)`,
        { vendor_id: id, ...ship }
      );
    }

    if (goodsShip) {
      await conn.query(
        `INSERT INTO vendor_shipping_addresses
         (vendor_id, contact_name, phone, address_line, subdistrict, district, province, postcode, country)
         VALUES
         (:vendor_id,:contact_name,:phone,:address_line,:subdistrict,:district,:province,:postcode,:country)`,
        { vendor_id: id, ...goodsShip }
      );
    }

    await conn.query(`DELETE FROM vendor_contacts WHERE vendor_id=:id`, { id });
    await conn.query(`DELETE FROM vendor_bank_accounts WHERE vendor_id=:id`, { id });
    await conn.query(`DELETE FROM vendor_people WHERE vendor_id=:id`, { id });

    for (const c of normalizeContacts(data.contacts)) {
      await conn.query(
        `INSERT INTO vendor_contacts (vendor_id, label, channel, value, is_primary, sort_order)
         VALUES (:vendor_id, :label, :channel, :value, :is_primary, :sort_order)`,
        { vendor_id: id, ...c }
      );
    }

    for (const p of normalizePeople(data.people)) {
      await conn.query(
        `INSERT INTO vendor_people
         (vendor_id, prefix, first_name, last_name, nickname, email, phone, position, department, is_primary, sort_order)
         VALUES
         (:vendor_id,:prefix,:first_name,:last_name,:nickname,:email,:phone,:position,:department,:is_primary,:sort_order)`,
        { vendor_id: id, ...p }
      );
    }

    for (const b of normalizeBanks(data.bank_accounts)) {
      await conn.query(
        `INSERT INTO vendor_bank_accounts
         (vendor_id, bank_code, bank_name, account_name, account_no, branch_code, is_default, sort_order)
         VALUES
         (:vendor_id,:bank_code,:bank_name,:account_name,:account_no,:branch_code,:is_default,:sort_order)`,
        { vendor_id: id, ...b }
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function setVendorActive(companyId, id, is_active) {
  const [r] = await pool.query(
    `UPDATE vendors SET is_active=:is_active
     WHERE id=:id AND company_id=:companyId`,
    { is_active, id, companyId }
  );
  if (r.affectedRows === 0) throw new HttpError(404, "Not found");
}
