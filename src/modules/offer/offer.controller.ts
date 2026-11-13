import { Router } from "express";
import { OfferService } from "./offer.service";
import { authorize } from "../auth/auth.middleware";

const router = Router();
const offerService = new OfferService();
router.get("/",offerService.get);
router.get("/latest",offerService.getLatest);
router.get("/next-number",authorize("sales", "manager", "admin"),offerService.getNextNumber);
router.get("/:id",offerService.getone);
router.post("/",authorize("sales", "manager", "admin"),offerService.create);
router.post("/:id/decision",authorize("admin"),offerService.decide);
router.put("/:id",authorize("sales", "manager", "admin"),offerService.update);
router.delete("/:id",authorize("sales", "manager", "admin"),offerService.delete);

export default router;
