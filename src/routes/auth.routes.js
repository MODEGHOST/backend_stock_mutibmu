import { Router } from "express";
import { z } from "zod";
import { login, refresh, me } from "../services/auth.service.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const out = await login(body.email, body.password);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const body = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const out = await refresh(body.refreshToken);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const out = await me(req.user.sub);
    res.json(out);
  } catch (e) {
    next(e);
  }
});

export default router;
