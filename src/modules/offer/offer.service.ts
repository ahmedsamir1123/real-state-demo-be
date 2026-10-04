import { Request, Response } from "express";
import { OfferRepository } from "../../db/model/offer/offer.db.service";
import { createDto } from "./offer.dto";
import { NotFoundException } from "../../utils/error";

export class OfferService {
    private offerRepository = new OfferRepository();
    constructor() { }

    create = async (req: Request, res: Response) => {
        const createDto: createDto = req.body;
        const createdOffer = await this.offerRepository.create(createDto);
        return res.status(201).json({ message: "offer created successfully", success: true, data: createdOffer });
    }

    get = async (req: Request, res: Response) => {
        const offers = await this.offerRepository.getAll({}, undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "offers retrieved successfully", success: true, data: offers });
    }

    getLatest = async (req: Request, res: Response) => {
        const offer = await this.offerRepository.getLatest();
        return res.status(200).json({ message: "latest offer retrieved successfully", success: true, data: offer });
    }

    getone = async (req: Request, res: Response) => {
        const offerId = req.params.id;
        const offer = await this.offerRepository.getOne({ _id: offerId });
        if (!offer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer retrieved successfully", success: true, data: offer });
    }

    update = async (req: Request, res: Response) => {
        const offerId = req.params.id;
        const updateDto: Partial<createDto> = req.body;
        const updatedOffer = await this.offerRepository.update({ _id: offerId }, updateDto);
        if (!updatedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer updated successfully", success: true, data: updatedOffer });
    }

    delete = async (req: Request, res: Response) => {
        const offerId = req.params.id;
        const deletedOffer = await this.offerRepository.delete({ _id: offerId });
        if (!deletedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer deleted successfully", success: true, data: deletedOffer });
    }
}
