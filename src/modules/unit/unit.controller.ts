import { Router } from "express";
import { UnitService } from "./unit.service";

const router = Router();
const unitService = new UnitService();
router.get("/",unitService.get);
router.get("/:id",unitService.getone);
router.post("/",unitService.create);
router.put("/:id",unitService.update);
router.delete("/:id",unitService.delete);

export default router;
