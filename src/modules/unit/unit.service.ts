import { Request, Response } from "express";
import { UnitRepository } from "../../db/model/unit/unit.db.service";
import { createDto } from "./unit.dto";
import { NotFoundException } from "../../utils/error";
import { QueryFilter } from "mongoose";
import { IUnit } from "../../utils/common/interfaces";

export class UnitService {
    private unitRepository = new UnitRepository();
    constructor() { }

    create = async (req: Request, res: Response) => {
        const createDto: createDto = req.body;
        const createdUnit = await this.unitRepository.create(createDto);
        return res.status(201).json({ message: "unit created successfully", success: true, data: createdUnit });
    }

    get = async (req: Request, res: Response) => {
        const filter: QueryFilter<IUnit> = {};
        if (typeof req.query.project === "string" && req.query.project) filter.project = req.query.project;
        if (typeof req.query.status === "string" && ["available", "on_hold", "reserved", "sold", "inactive"].includes(req.query.status)) {
            filter.status = req.query.status as IUnit["status"];
        }
        const units = await this.unitRepository.getAll(filter, undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "units retrieved successfully", success: true, data: units });
    }

    getone = async (req: Request<{ id: string }>, res: Response) => {
        const unitId = req.params.id;
        const unit = await this.unitRepository.getOne({ _id: unitId });
        if (!unit) throw new NotFoundException("unit not found");
        return res.status(200).json({ message: "unit retrieved successfully", success: true, data: unit });
    }

    update = async (req: Request<{ id: string }>, res: Response) => {
        const unitId = req.params.id;
        const updateDto: Partial<createDto> = req.body;
        const updatedUnit = await this.unitRepository.update({ _id: unitId }, updateDto);
        if (!updatedUnit) throw new NotFoundException("unit not found");
        return res.status(200).json({ message: "unit updated successfully", success: true, data: updatedUnit });
    }

    delete = async (req: Request<{ id: string }>, res: Response) => {
        const unitId = req.params.id;
        const deletedUnit = await this.unitRepository.delete({ _id: unitId });
        if (!deletedUnit) throw new NotFoundException("unit not found");
        return res.status(200).json({ message: "unit deleted successfully", success: true, data: deletedUnit });
    }
}
