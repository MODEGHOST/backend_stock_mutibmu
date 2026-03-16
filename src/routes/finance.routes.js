import express from "express";
import { auth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import * as financeService from "../services/finance.service.js";

const router = express.Router();

router.use(auth);

// Optional: If you want strict role-based access control later, you can add:
// router.use(requirePermission("finance.manage"));

// 1. List all accounts
router.get("/", async (req, res) => {
  try {
    const rows = await financeService.listAccounts(req.user.company_id);
    res.json(rows);
  } catch (error) {
    console.error("[finance.routes] GET / Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Create account
router.post("/", async (req, res) => {
  try {
    const created = await financeService.createAccount(req.user.company_id, req.body);
    res.status(201).json(created);
  } catch (error) {
    console.error("[finance.routes] POST / Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Update account
router.put("/:id", async (req, res) => {
  try {
    const updated = await financeService.updateAccount(req.user.company_id, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error("[finance.routes] PUT /:id Error:", error);
    res.status(400).json({ error: error.message });
  }
});

// 4. Get account transactions
router.get("/:id/transactions", async (req, res) => {
  try {
    const rows = await financeService.getAccountTransactions(req.user.company_id, req.params.id, req.query);
    res.json(rows);
  } catch (error) {
    console.error("[finance.routes] GET /:id/transactions Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete account
router.delete("/:id", async (req, res) => {
  try {
    await financeService.deleteAccount(req.user.company_id, req.params.id);
    res.json({ message: "Account deleted successfully." });
  } catch (error) {
    console.error("[finance.routes] DELETE /:id Error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
