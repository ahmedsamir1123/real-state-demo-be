import { Response } from "express";
import { Types } from "mongoose";
import { OfferRepository } from "../../db/model/offer/offer.db.service";
import { createDto } from "./offer.dto";
import { NotFoundException } from "../../utils/error";
import { AuthenticatedRequest } from "../auth/auth.types";

export class OfferService {
    private offerRepository = new OfferRepository();
    constructor() { }

    private accessFilter(req: AuthenticatedRequest) {
        return req.user!.role === "admin" || req.user!.role === "manager"
            ? {}
            : { createdBy: new Types.ObjectId(req.user!.id) };
    }

    create = async (req: AuthenticatedRequest, res: Response) => {
        const createDto: createDto = {
            ...req.body,
            createdBy: new Types.ObjectId(req.user!.id)
        };
        const createdOffer = await this.offerRepository.create(createDto);
        return res.status(201).json({ message: "offer created successfully", success: true, data: createdOffer });
    }

    get = async (req: AuthenticatedRequest, res: Response) => {
        const offers = await this.offerRepository.getAll(this.accessFilter(req), undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "offers retrieved successfully", success: true, data: offers });
    }

    getLatest = async (req: AuthenticatedRequest, res: Response) => {
        const offer = await this.offerRepository.getOne(this.accessFilter(req), undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "latest offer retrieved successfully", success: true, data: offer });
    }

    getone = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const offer = await this.offerRepository.getOne({ _id: offerId, ...this.accessFilter(req) });
        if (!offer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer retrieved successfully", success: true, data: offer });
    }

    update = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const { createdBy: _createdBy, ...updateDto } = req.body as Partial<createDto>;
        const updatedOffer = await this.offerRepository.update(
            { _id: offerId, ...this.accessFilter(req) },
            updateDto
        );
        if (!updatedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer updated successfully", success: true, data: updatedOffer });
    }

    delete = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const deletedOffer = await this.offerRepository.delete({ _id: offerId, ...this.accessFilter(req) });
        if (!deletedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer deleted successfully", success: true, data: deletedOffer });
    }
}
