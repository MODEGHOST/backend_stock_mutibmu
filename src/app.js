import express from "express";
import cors from "cors";
import helmet from "helmet";
import HttpError from "./utils/httpError.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productRoutes from "./routes/product.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import stockRoutes from "./routes/stock.routes.js";
import adjustmentRoutes from "./routes/adjustment.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import adminUsersRouter from "./routes/adminUsers.routes.js";
import adminRolesRoutes from "./routes/adminRoles.routes.js";
import companyRoutes from "./routes/company.routes.js";
import billingNoteRoutes from "./routes/billing-note.routes.js";
import transferRoutes from "./routes/transfer.routes.js";
import countRoutes from "./routes/count.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import commissionsRoutes from "./routes/commissions.routes.js";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use("/products", productRoutes);
  app.use("/warehouses", warehouseRoutes);
  app.use("/vendors", vendorRoutes);
  app.use("/purchase", purchaseRoutes);
  app.use("/sales", salesRoutes);
  app.use("/stock", stockRoutes);
  app.use("/adjustments", adjustmentRoutes);
  app.use("/reports", reportsRoutes);
  app.use("/admin", adminUsersRouter);
  app.use("/admin", adminRolesRoutes);
  app.use("/company", companyRoutes);
  app.use("/billing-notes", billingNoteRoutes);
  app.use("/stock/transfers", transferRoutes);
  app.use("/stock/counts", countRoutes);
  app.use("/finance-accounts", financeRoutes);
  app.use("/commissions", commissionsRoutes);

  app.use((req, res) => res.status(404).json({ message: "Not found" }));

  app.use((err, req, res, next) => {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err?.message || "Server error";
    res.status(status).json({ message });
  });

  return app;
}
