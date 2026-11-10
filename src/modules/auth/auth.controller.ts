import { Router } from "express";
import { AuthService } from "./auth.service";
import { authenticate, authorize } from "./auth.middleware";

const router = Router();
const authService = new AuthService();

router.post("/login", authService.login);
router.post("/refresh", authService.refresh);
router.post("/logout", authenticate, authService.logout);
router.get("/me", authenticate, authService.me);
router.post("/users", authenticate, authorize("admin"), authService.createUser);

export default router;
