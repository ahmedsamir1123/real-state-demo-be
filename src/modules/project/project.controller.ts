import { Router } from "express";
import { ProjectService } from "./project.service";
import { authorize } from "../auth/auth.middleware";

const router = Router();
const projectService = new ProjectService();
router.get("/",projectService.get);
router.get("/:id",projectService.getone);
router.post("/", authorize("manager", "admin"), projectService.create);
router.put("/:id", authorize("manager", "admin"), projectService.update);
router.delete("/:id", authorize("manager", "admin"), projectService.delete);

export default router;
