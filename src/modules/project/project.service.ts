import { Request, Response } from "express";
import { ProjectRepository } from "../../db/model/project/project.db.service";
import { createDto } from "./project.dto";
import { NotFoundException } from "../../utils/error";
import { AuthenticatedRequest } from "../auth/auth.types";

export class ProjectService {
    private projectRepository = new ProjectRepository();
    constructor() { }

    private presentProject(project: any, isAdmin: boolean) {
        if (isAdmin) return project;
        const value = typeof project?.toObject === "function" ? project.toObject() : { ...project };
        const fallbackRate = Number(value.financialPolicy?.annualDiscountRate ?? 0);
        value.paymentPlans = (value.paymentPlans || []).map((source: any) => {
            const plan = typeof source?.toObject === "function" ? source.toObject() : { ...source };
            const rate = Number(plan.annualDiscountRate ?? fallbackRate);
            const allocation = Math.min(100, Math.max(0, Number(plan.customerDiscountPct ?? 100)));
            const customerXnpvRatePct = Math.max(0, rate) * allocation / 100;
            delete plan.customerDiscountPct;
            return { ...plan, customerXnpvRatePct };
        });
        return value;
    }

    create = async (req: Request, res: Response) => {
        const createDto: createDto = req.body;
        const createdProject = await this.projectRepository.create(createDto)
        return res.status(201).json({ message: "project created successfully", success: true, data: createdProject });

    }

    get = async (req: AuthenticatedRequest, res: Response) => {
        const projects = await this.projectRepository.getAll();
        return res.status(200).json({ message: "projects retrieved successfully", success: true, data: projects.map((project) => this.presentProject(project, req.user!.role === "admin")) });
    }

    getone = async (req: AuthenticatedRequest, res: Response) => {
        const projectId = req.params.id;
        const project = await this.projectRepository.getOne({ _id: projectId });
        if (!project) throw new NotFoundException("project not found");
        return res.status(200).json({ message: "project retrieved successfully", success: true, data: this.presentProject(project, req.user!.role === "admin") });
    }

    getDiscountPolicy = async (req: AuthenticatedRequest, res: Response) => {
        const project = await this.projectRepository.getOne({ _id: req.params.id });
        if (!project) throw new NotFoundException("project not found");
        const plan = project.paymentPlans.find((item: any) => String(item._id) === String(req.params.planId));
        if (!plan) throw new NotFoundException("project payment plan not found");
        const totalMarginPct = Math.max(0, Number(plan.annualDiscountRate ?? project.financialPolicy?.annualDiscountRate ?? 0));
        const customerAllocationPct = Math.min(100, Math.max(0, Number(plan.customerDiscountPct ?? 100)));
        const managementAllocationPct = 100 - customerAllocationPct;
        const customerMarginPct = totalMarginPct * customerAllocationPct / 100;
        const managementMarginPct = totalMarginPct - customerMarginPct;
        return res.status(200).json({
            message: "discount policy retrieved successfully",
            success: true,
            data: { totalMarginPct, customerAllocationPct, managementAllocationPct, customerMarginPct, managementMarginPct }
        });
    }

    update = async (req: Request, res: Response) => {
        const projectId = req.params.id;
        const updateDto: Partial<createDto> = req.body;
        const updatedProject = await this.projectRepository.getOne({ _id: projectId });
        if (!updatedProject) throw new NotFoundException("project not found");
        updatedProject.set(updateDto);
        await updatedProject.save();
        return res.status(200).json({ message: "project updated successfully", success: true, data: updatedProject });

    }
    delete = async (req: Request, res: Response) => {
        const projectId = req.params.id;
        const deletedProject = await this.projectRepository.delete({ _id: projectId });
        if (!deletedProject) throw new NotFoundException("project not found");
        return res.status(200).json({ message: "project deleted successfully", success: true, data: deletedProject });

    }
}
