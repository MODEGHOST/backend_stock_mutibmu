import { pool } from "../config/db.js";

export async function stockSummary(companyId) {
  const [rows] = await pool.query(
    `
    SELECT ps.company_id, ps.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
           ps.product_id, p.code AS product_code, p.name AS product_name, ps.qty, ps.updated_at
    FROM product_stock ps
    JOIN warehouses w ON w.id=ps.warehouse_id
    JOIN products p ON p.id=ps.product_id
    WHERE ps.company_id=:companyId
    ORDER BY w.id DESC, p.id DESC
    `,
    { companyId }
  );
  return rows;
}

export async function fifoLots(companyId, productId, warehouseId) {
  const [rows] = await pool.query(
    `
    SELECT id, received_date, unit_cost, qty_in, qty_out, (qty_in-qty_out) AS available, ref_type, ref_id, created_at
    FROM stock_lots
    WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
    ORDER BY received_date ASC, id ASC
    `,
    { companyId, productId, warehouseId }
  );
  return rows;
}

export async function stockCheck(companyId, productId, warehouseId) {
  const [rows] = await pool.query(
    `SELECT qty FROM product_stock WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId LIMIT 1`,
    { companyId, productId, warehouseId }
  );
  return { qty: rows.length ? Number(rows[0].qty) : 0 };
}

export async function fifoHistory(companyId, productId, type, warehouseId) {
  let warehouseClause = '';
  let params = { companyId, productId };
  if (type === 'WAREHOUSE') {
    warehouseClause = 'AND sm.warehouse_id = :warehouseId';
    params.warehouseId = warehouseId;
  }

  // 1. Fetch all moves for this product
  const [moves] = await pool.query(
    `
    SELECT 
      sm.id as move_id,
      sm.created_at,
      sm.ref_type,
      sm.ref_id,
      sm.move_type,
      sm.qty,
      sm.note,
      w.code as warehouse_code,
      w.name as warehouse_name
    FROM stock_moves sm
    LEFT JOIN warehouses w ON sm.warehouse_id = w.id
    WHERE sm.company_id = :companyId AND sm.product_id = :productId
    ${warehouseClause}
    ORDER BY sm.created_at ASC, sm.id ASC
    `,
    params
  );

  // 2. Fetch all lot moves for this product
  const [lotMoves] = await pool.query(
    `
    SELECT slm.* 
    FROM stock_lot_moves slm
    JOIN stock_lots sl ON sl.id = slm.lot_id
    WHERE slm.company_id = :companyId AND sl.product_id = :productId
    `,
    { companyId, productId }
  );

  // Group lot moves by ref_type and ref_id
  const lotMovesMap = {};
  for (const lm of lotMoves) {
    const key = `${lm.ref_type}_${lm.ref_id}`;
    if (!lotMovesMap[key]) lotMovesMap[key] = [];
    lotMovesMap[key].push(lm);
  }

  // 3. Process each move to compute running balances and transaction values
  let balanceQty = 0;
  let balanceValue = 0;
  const history = [];

  for (const sm of moves) {
    const moveQty = Math.abs(Number(sm.qty));
    let moveValue = 0;
    const lotDetails = [];

    // Determine the relevant lot moves based on ref_type mapping
    let targetRefType = sm.ref_type;
    if (sm.ref_type === 'SALE_CANCEL') targetRefType = 'SALE';
    if (sm.ref_type === 'GRN_CANCEL') targetRefType = 'GRN'; // assuming reversals don't have their own lot_moves

    const key = `${targetRefType}_${sm.ref_id}`;
    const myLotMoves = lotMovesMap[key] || [];

    // Filter lot moves for Transfers
    let filteredLotMoves = myLotMoves;
    if (sm.ref_type === 'TF') {
       if (sm.move_type === 'OUT') {
         filteredLotMoves = myLotMoves.filter(lm => Number(lm.qty) < 0);
       } else {
         filteredLotMoves = myLotMoves.filter(lm => Number(lm.qty) > 0);
       }
    }

    for (const lm of filteredLotMoves) {
      const lq = Math.abs(Number(lm.qty));
      const uc = Number(lm.unit_cost);
      moveValue += lq * uc;
      lotDetails.push({ qty: lq, unit_cost: uc });
    }

    if (sm.move_type === 'IN') {
      balanceQty += moveQty;
      balanceValue += moveValue; // IN increases total inventory value
    } else {
      balanceQty -= moveQty;
      balanceValue -= moveValue; // OUT decreases inventory value based on FIFO cost
    }

    history.push({
      ...sm,
      display_qty: moveQty,
      move_value: moveValue,
      balance_qty: balanceQty,
      balance_value: balanceValue,
      lot_details: lotDetails
    });
  }

  return history;
}
