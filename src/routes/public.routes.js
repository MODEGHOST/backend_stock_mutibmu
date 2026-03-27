import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

router.get('/p/:hash', async (req, res, next) => {
  try {
    const hash = req.params.hash;
    const decoded = Buffer.from(hash, 'base64').toString('utf8');
    const [companyId, productId] = decoded.split(':');
    if (!companyId || !productId || isNaN(Number(companyId)) || isNaN(Number(productId))) {
      return res.status(404).json({ message: 'Invalid QR Code format' });
    }
    const [products] = await pool.query('SELECT code, name, unit FROM products WHERE company_id=? AND id=? LIMIT 1', [companyId, productId]);
    if (products.length === 0) return res.status(404).json({ message: 'Product not found' });
    const [stock] = await pool.query('SELECT SUM(qty) as total_qty FROM product_stock WHERE company_id=? AND product_id=?', [companyId, productId]);
    res.json({ code: products[0].code, name: products[0].name, unit: products[0].unit, qty: Number(stock[0].total_qty || 0) });
  } catch (err) {
    res.status(400).json({ message: 'Invalid QR Code' });
  }
});

export default router;