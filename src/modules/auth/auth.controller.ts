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
router.get("/users", authenticate, authorize("admin", "department_manager"), authService.listUsers);
router.patch("/users/:id", authenticate, authorize("admin"), authService.updateUser);
router.patch("/users/:id/manager", authenticate, authorize("admin"), authService.assignManager);

export default router;
