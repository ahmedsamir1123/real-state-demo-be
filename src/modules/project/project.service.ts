import { Request, Response } from "express";
import { ProjectRepository } from "../../db/model/project/project.db.service";
import { createDto } from "./project.dto";
import { NotFoundException } from "../../utils/error";

export class ProjectService {
    private projectRepository = new ProjectRepository();
    constructor() { }

    create = async (req: Request, res: Response) => {
        const createDto: createDto = req.body;
        const createdProject = await this.projectRepository.create(createDto)
        return res.status(201).json({ message: "project created successfully", success: true, data: createdProject });

    }

    get = async (req: Request, res: Response) => {
        const projects = await this.projectRepository.getAll();
        return res.status(200).json({ message: "projects retrieved successfully", success: true, data: projects });
    }

    getone = async (req: Request, res: Response) => {
        const projectId = req.params.id;
        const project = await this.projectRepository.getOne({ _id: projectId });
        if (!project) throw new NotFoundException("project not found");
        return res.status(200).json({ message: "project retrieved successfully", success: true, data: project });
    }

    update = async (req: Request, res: Response) => {
        const projectId = req.params.id;
        const updateDto: Partial<createDto> = req.body;
        const updatedProject = await this.projectRepository.update({ _id: projectId }, updateDto);
        if (!updatedProject) throw new NotFoundException("project not found");
        return res.status(200).json({ message: "project updated successfully", success: true, data: updatedProject });

    }
    delete = async (req: Request, res: Response) => {
        const projectId = req.params.id;
        const deletedProject = await this.projectRepository.delete({ _id: projectId });
        if (!deletedProject) throw new NotFoundException("project not found");
        return res.status(200).json({ message: "project deleted successfully", success: true, data: deletedProject });

    }
}
