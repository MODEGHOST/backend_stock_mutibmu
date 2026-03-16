import { pool } from "../config/db.js";

// List all finance accounts for a company
export async function listAccounts(companyId) {
  const [rows] = await pool.query(
    `
    SELECT * FROM finance_accounts 
    WHERE company_id = :companyId AND is_active = TRUE
    ORDER BY type ASC, id DESC
    `,
    { companyId }
  );
  return rows;
}

// Create a new finance account
export async function createAccount(companyId, data) {
  const {
    type, name, provider_name, account_no, account_name, person_name, contact_number, balance
  } = data;

  const [result] = await pool.query(
    `
    INSERT INTO finance_accounts (
      company_id, type, name, provider_name, account_no, account_name, person_name, contact_number, balance
    ) VALUES (
      :companyId, :type, :name, :provider_name, :account_no, :account_name, :person_name, :contact_number, :balance
    )
    `,
    {
      companyId,
      type,
      name,
      provider_name: provider_name || null,
      account_no: account_no || null,
      account_name: account_name || null,
      person_name: person_name || null,
      contact_number: contact_number || null,
      balance: balance || 0.00
    }
  );

  return { id: result.insertId, ...data };
}

// Update an existing finance account
export async function updateAccount(companyId, accountId, data) {
  const {
    type, name, provider_name, account_no, account_name, person_name, contact_number, balance
  } = data;

  const [result] = await pool.query(
    `
    UPDATE finance_accounts
    SET 
      type = :type,
      name = :name,
      provider_name = :provider_name,
      account_no = :account_no,
      account_name = :account_name,
      person_name = :person_name,
      contact_number = :contact_number,
      balance = :balance
    WHERE id = :accountId AND company_id = :companyId
    `,
    {
      companyId,
      accountId,
      type,
      name,
      provider_name: provider_name || null,
      account_no: account_no || null,
      account_name: account_name || null,
      person_name: person_name || null,
      contact_number: contact_number || null,
      balance: balance !== undefined ? balance : 0.00
    }
  );

  if (result.affectedRows === 0) {
    throw new Error("Account not found or access denied.");
  }

  return { id: accountId, ...data };
}

// Soft delete a finance account (set is_active = false)
export async function deleteAccount(companyId, accountId) {
  const [result] = await pool.query(
    `UPDATE finance_accounts SET is_active = FALSE WHERE id = :accountId AND company_id = :companyId`,
    { companyId, accountId }
  );
  
  if (result.affectedRows === 0) {
    throw new Error("Account not found or access denied.");
  }
  
  return true;
}

// Update the balance of a finance account directly
export async function updateBalance(companyId, accountId, amountDiff) {
  const [result] = await pool.query(
    `
    UPDATE finance_accounts 
    SET balance = balance + :amountDiff 
    WHERE id = :accountId AND company_id = :companyId
    `,
    { companyId, accountId, amountDiff }
  );

  if (result.affectedRows === 0) {
    throw new Error("Account not found or access denied.");
  }

  return true;
}

// Get transaction history for an account
export async function getAccountTransactions(companyId, accountId, queryParams = {}) {
  const { startDate, endDate, limit = 50, offset = 0 } = queryParams;

  let whereClause = `t.company_id = :companyId AND t.finance_account_id = :accountId`;
  const params = { companyId, accountId, limit: Number(limit), offset: Number(offset) };

  if (startDate) {
    whereClause += ` AND DATE(t.transaction_date) >= :startDate`;
    params.startDate = startDate;
  }
  if (endDate) {
    whereClause += ` AND DATE(t.transaction_date) <= :endDate`;
    params.endDate = endDate;
  }

  // To build a proper running balance (ledger style), we ideally need to calculate it from the 
  // beginning of time, or use a window function if we fetch all.
  // For safety and compatibility with older MySQL, we will fetch all matching rows ascending 
  // (or calculate in JS if we just load the recent `limit`).
  // 
  // To show a true running balance for a paginated view, we actually need the "Opening Balance" 
  // up to the startDate.
  
  // 1. Get opening balance before startDate (if applicable)
  let openingBalance = 0;
  if (startDate) {
     const [balRows] = await pool.query(
        `SELECT SUM(IF(transaction_type = 'INCOME', amount, -amount)) as opening 
         FROM finance_transactions 
         WHERE company_id = :companyId 
           AND finance_account_id = :accountId 
           AND DATE(transaction_date) < :startDate`,
        { companyId, accountId, startDate }
     );
     openingBalance = Number(balRows[0].opening) || 0;
  } else {
     // If no start date, opening balance is 0 since we'll fetch from the beginning.
     // However, finance_accounts has an initial 'balance' which might be from migrations.
     // It's safer to just rely on the transaction history sum.
  }

  // 2. Fetch the actual rows (ASC order for ledger calculation)
  const [rows] = await pool.query(
    `
    SELECT 
      t.id,
      t.transaction_type,
      t.amount,
      t.reference_type,
      t.reference_id,
      t.transaction_date,
      t.created_at,
      
      -- Sales Info
      s.invoice_no,
      s.receipt_no,
      v_sales.name AS sales_customer_name,
      
      -- Purchase Info
      pb.bill_no,
      pb.tax_invoice_no AS purchase_tax_invoice,
      v_purchases.name AS purchase_vendor_name
      
    FROM finance_transactions t
    
    LEFT JOIN sales s ON t.reference_type = 'SALES_RECEIPT' AND t.reference_id = s.id
    LEFT JOIN vendors v_sales ON s.customer_id = v_sales.id
    
    LEFT JOIN purchase_bills pb ON t.reference_type = 'PURCHASE_BILL' AND t.reference_id = pb.id
    LEFT JOIN vendors v_purchases ON pb.vendor_id = v_purchases.id
    
    WHERE ${whereClause}
    ORDER BY t.transaction_date ASC, t.id ASC
    `,
    params
  );

  // Calculate Running Balance
  let currentBalance = openingBalance;
  for (let row of rows) {
    const amt = Number(row.amount);
    if (row.transaction_type === "INCOME") {
      currentBalance += amt;
    } else {
      currentBalance -= amt;
    }
    row.running_balance = currentBalance;
  }

  // Apply limit/offset manually in JS since we needed all rows for calculation
  // Finally, sort DESC so the newest is at the top (standard for statements)
  const sortedDesc = rows.reverse();
  const paginated = sortedDesc.slice(params.offset, params.offset + params.limit);

  return paginated;
}
