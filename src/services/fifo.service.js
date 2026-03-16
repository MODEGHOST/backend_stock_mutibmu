import HttpError from "../utils/httpError.js";

export async function fifoConsume(conn, companyId, productId, warehouseId, qtyNeed, refType, refId) {
  let remaining = qtyNeed;
  let cogs = 0;

  while (remaining > 0) {
    const [lots] = await conn.query(
      `
      SELECT id, unit_cost, (qty_in - qty_out) AS available
      FROM stock_lots
      WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:warehouseId
        AND (qty_in - qty_out) > 0
      ORDER BY received_date ASC, id ASC
      LIMIT 1
      FOR UPDATE
      `,
      { companyId, productId, warehouseId }
    );

    if (lots.length === 0) throw new HttpError(400, "Insufficient stock for FIFO");

    const lot = lots[0];
    const take = Math.min(remaining, Number(lot.available));
    remaining -= take;

    await conn.query(
      `UPDATE stock_lots SET qty_out = qty_out + :take WHERE id=:id`,
      { take, id: lot.id }
    );

    await conn.query(
      `
      INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
      VALUES (:company_id, :lot_id, :ref_type, :ref_id, :qty, :unit_cost)
      `,
      {
        company_id: companyId,
        lot_id: lot.id,
        ref_type: refType,
        ref_id: refId,
        qty: take,
        unit_cost: lot.unit_cost
      }
    );

    cogs += take * Number(lot.unit_cost);
  }

  return { cogs };
}

export async function addLotTransferMoves(conn, {
  companyId,
  refType,
  refId,
  sourceWarehouseId,
  targetWarehouseId,
  productId,
  qty,
  userId
}) {
  let remaining = qty;

  while (remaining > 0) {
    const [lots] = await conn.query(
      `
      SELECT id, unit_cost, (qty_in - qty_out) AS available
      FROM stock_lots
      WHERE company_id=:companyId AND product_id=:productId AND warehouse_id=:sourceWarehouseId
        AND (qty_in - qty_out) > 0
      ORDER BY received_date ASC, id ASC
      LIMIT 1
      FOR UPDATE
      `,
      { companyId, productId, sourceWarehouseId }
    );

    if (lots.length === 0) throw new HttpError(400, "Insufficient stock for FIFO Transfer");

    const lot = lots[0];
    const take = Math.min(remaining, Number(lot.available));
    remaining -= take;

    // 1. Deduct from source lot
    await conn.query(
      `UPDATE stock_lots SET qty_out = qty_out + :take WHERE id=:id`,
      { take, id: lot.id }
    );

    // 2. Record source lot move (OUT)
    await conn.query(
      `
      INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
      VALUES (:companyId, :lotId, :refType, :refId, :qty, :unitCost)
      `,
      {
        companyId,
        lotId: lot.id,
        refType,
        refId,
        qty: -take, // Transfer out
        unitCost: lot.unit_cost
      }
    );

    // 3. Create target lot (IN) preserving unit_cost and received_date
    const [newLot] = await conn.query(
      `
      INSERT INTO stock_lots (company_id, product_id, warehouse_id, ref_type, ref_id, received_date, unit_cost, qty_in, qty_out)
      VALUES (:companyId, :productId, :targetWarehouseId, :refType, :refId, NOW(), :unitCost, :qty, 0)
      `,
      {
        companyId,
        productId,
        targetWarehouseId,
        refType,
        refId,
        unitCost: lot.unit_cost,
        qty: take
      }
    );

    // 4. Record target lot move (IN)
    await conn.query(
      `
      INSERT INTO stock_lot_moves (company_id, lot_id, ref_type, ref_id, qty, unit_cost)
      VALUES (:companyId, :lotId, :refType, :refId, :qty, :unitCost)
      `,
      {
        companyId,
        lotId: newLot.insertId,
        refType,
        refId,
        qty: take, // Transfer in
        unitCost: lot.unit_cost
      }
    );
  }

  // 5. Update global stock_moves
  // Source (OUT)
  await conn.query(
    `
    INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
    VALUES (?, ?, ?, ?, ?, 'OUT', ?, ?, ?)
    `,
    [companyId, refType, refId, productId, sourceWarehouseId, -qty, `Transfer OUT (TF-${refId})`, userId]
  );
  // Target (IN)
  await conn.query(
    `
    INSERT INTO stock_moves (company_id, ref_type, ref_id, product_id, warehouse_id, move_type, qty, note, created_by)
    VALUES (?, ?, ?, ?, ?, 'IN', ?, ?, ?)
    `,
    [companyId, refType, refId, productId, targetWarehouseId, qty, `Transfer IN (TF-${refId})`, userId]
  );

  // 6. Update global product_stock table
  // Deduct from Source
  await conn.query(
    `
    UPDATE product_stock 
    SET qty = qty - ?, updated_at = NOW() 
    WHERE company_id = ? AND warehouse_id = ? AND product_id = ?
    `,
    [qty, companyId, sourceWarehouseId, productId]
  );

  // Add to Target (Insert if not exists, though it usually should via UI or trigger, we'll use ON DUPLICATE KEY UPDATE)
  await conn.query(
    `
    INSERT INTO product_stock (company_id, warehouse_id, product_id, qty)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE qty = qty + ?, updated_at = NOW()
    `,
    [companyId, targetWarehouseId, productId, qty, qty]
  );
}
