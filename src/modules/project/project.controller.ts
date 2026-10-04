import { Router } from "express";
import { ProjectService } from "./project.service";

const router = Router();
const projectService = new ProjectService();
router.get("/",projectService.get);
router.get("/:id",projectService.getone);
router.post("/",projectService.create);
router.put("/:id",projectService.update);
router.delete("/:id",projectService.delete);

export default router;
