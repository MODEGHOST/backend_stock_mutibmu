// src/routes/reports.routes.js
import { Router } from "express";
import { z } from "zod";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  dashboardSummary,
  lowStock,
  hotSellers,
  commissionBySeller,
  salesTrend,
  salesBySeller,
   sellerInvoices,    
  saleInvoiceDetail,
  topVendors,
  exportStock,
  stockCard,
  arApAging,
} from "../services/reports.service.js";

const router = Router();

// ✅ GET /reports/dashboard-summary?from&to&lowStockThreshold
router.get("/dashboard-summary", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
      lowStockThreshold: z.coerce.number().min(0).default(10),
    }).parse(req.query);

    res.json(await dashboardSummary(companyId, q.from, q.to, q.lowStockThreshold));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/low-stock?threshold&limit
router.get("/low-stock", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      threshold: z.coerce.number().min(0).default(10),
      limit: z.coerce.number().min(1).max(200).default(50),
    }).parse(req.query);

    res.json(await lowStock(companyId, q.threshold, q.limit));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/hot-sellers?from&to&topN
router.get("/hot-sellers", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
      topN: z.coerce.number().min(1).max(100).default(10),
    }).parse(req.query);

    res.json(await hotSellers(companyId, q.from, q.to, q.topN));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/commission/by-seller?from&to
router.get("/commission/by-seller", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
    }).parse(req.query);

    res.json(await commissionBySeller(companyId, q.from, q.to));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/sales-trend?from&to
router.get("/sales-trend", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
    }).parse(req.query);

    res.json(await salesTrend(companyId, q.from, q.to));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/sales-by-seller?date=YYYY-MM-DD
router.get("/sales-by-seller", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }).parse(req.query);

    res.json(await salesBySeller(companyId, q.date));
  } catch (e) {
    next(e);
  }
});

router.get("/seller-invoices", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
      sellerId: z.string().min(1), // "2" หรือ "null"
    }).parse(req.query);

    res.json(await sellerInvoices(companyId, q.from, q.to, q.sellerId));
  } catch (e) {
    next(e);
  }
});

// ✅ NEW 2) คลิ๊ก INV -> ดูรายละเอียดในใบ (items)
// GET /reports/sale-invoice-detail?saleId=10
router.get("/sale-invoice-detail", auth, requirePermission("sales.inv.manage"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      saleId: z.coerce.number().int().positive(),
    }).parse(req.query);

    res.json(await saleInvoiceDetail(companyId, q.saleId));
  } catch (e) {
    next(e);
  }
});

// ✅ GET /reports/top-vendors?from&to&topN
router.get("/top-vendors", auth, requirePermission("stock.view"), async (req, res, next) => {
  try {
    const companyId = req.user.company_id;
    const q = z.object({
      from: z.string().min(8),
      to: z.string().min(8),
      topN: z.coerce.number().min(1).max(50).default(10),
    }).parse(req.query);

    const data = await topVendors(req.user.company_id, q.from, q.to, q.topN); // Adjusted to match original service call signature
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/stock/export", auth, requirePermission("stock.view"), async (req, res, next) => { // Added auth and permission
  try {
    const buffer = await exportStock(req.user.company_id);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=stock_export_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

// ========== New Reports ==========

router.get("/stock-card", auth, requirePermission("reports.view"), async (req, res, next) => {
  try {
    const { product_id, warehouse_id, from, to } = req.query;
    if (!product_id || !from || !to) {
      return res.status(400).json({ message: "product_id, from, to are required" });
    }
    const data = await stockCard(
      req.user.company_id, 
      Number(product_id), 
      warehouse_id ? Number(warehouse_id) : null,
      from, 
      to
    );
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.get("/aging", auth, requirePermission("reports.view"), async (req, res, next) => {
  try {
    // type = 'AR' (ลูกหนี้) or 'AP' (เจ้าหนี้)
    const { type } = req.query;
    const data = await arApAging(req.user.company_id, type || "AR");
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
