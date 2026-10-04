import { Router } from "express";
import { OfferService } from "./offer.service";

const router = Router();
const offerService = new OfferService();
router.get("/",offerService.get);
router.get("/latest",offerService.getLatest);
router.get("/:id",offerService.getone);
router.post("/",offerService.create);
router.put("/:id",offerService.update);
router.delete("/:id",offerService.delete);

export default router;
