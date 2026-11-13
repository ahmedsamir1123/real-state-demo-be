import { Response } from "express";
import { Types } from "mongoose";
import { OfferRepository } from "../../db/model/offer/offer.db.service";
import { offer } from "../../db/model/offer/offer.model";
import { offerCounter } from "../../db/model/offer/offer-counter.model";
import { User } from "../../db/model/user/user.model";
import { createDto } from "./offer.dto";
import { BadRequestException, NotFoundException } from "../../utils/error";
import { AuthenticatedRequest } from "../auth/auth.types";

export class OfferService {
    private offerRepository = new OfferRepository();
    constructor() { }

    private async accessFilter(req: AuthenticatedRequest) {
        if (req.user!.role === "admin" || req.user!.role === "department_manager") return {};
        const ownerId = new Types.ObjectId(req.user!.id);
        if (req.user!.role !== "manager") return { createdBy: ownerId };
        const team = await User.find({ role: "sales", managerId: ownerId }).select("_id").lean();
        return { createdBy: { $in: [ownerId, ...team.map((user) => user._id)] } };
    }

    private editFilter(req: AuthenticatedRequest) {
        return req.user!.role === "admin" ? {} : { createdBy: new Types.ObjectId(req.user!.id) };
    }

    private async ensureOfferCounter() {
        const counter = await offerCounter.findById("offer");
        if (counter) return counter.lastNumber;

        const numberedOffers = await offer.find({ offerNo: /^\d+$/ }).select("offerNo").lean();
        const highest = numberedOffers.reduce((max, item) => Math.max(max, Number(item.offerNo)), 1000);
        try {
            await offerCounter.updateOne(
                { _id: "offer" },
                { $setOnInsert: { lastNumber: highest } },
                { upsert: true }
            );
        } catch (error) {
            // Another request may have initialized the counter at the same time.
            if ((error as { code?: number }).code !== 11000) throw error;
        }
        const initialized = await offerCounter.findById("offer");
        if (!initialized) throw new Error("Offer number counter could not be initialized");
        return initialized.lastNumber;
    }

    getNextNumber = async (_req: AuthenticatedRequest, res: Response) => {
        const lastNumber = await this.ensureOfferCounter();
        return res.status(200).json({ message: "next offer number retrieved successfully", success: true, data: { offerNo: String(lastNumber + 1) } });
    }

    create = async (req: AuthenticatedRequest, res: Response) => {
        await this.ensureOfferCounter();
        const counter = await offerCounter.findOneAndUpdate(
            { _id: "offer" },
            { $inc: { lastNumber: 1 } },
            { new: true }
        );
        if (!counter) throw new Error("Offer number counter is unavailable");
        const createDto: createDto = {
            ...req.body,
            offerNo: String(counter.lastNumber),
            salesAgent: { name: req.user!.name },
            createdBy: new Types.ObjectId(req.user!.id),
            status: req.body.calculationResult?.accepted === false ? "pending_approval" : "draft",
            approvedAt: undefined,
            approvedBy: undefined,
            rejectedAt: undefined,
            rejectedBy: undefined,
            rejectionReason: undefined
        };
        const createdOffer = await this.offerRepository.create(createDto);
        return res.status(201).json({ message: "offer created successfully", success: true, data: createdOffer });
    }

    get = async (req: AuthenticatedRequest, res: Response) => {
        const offers = await this.offerRepository.getAll(await this.accessFilter(req), undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "offers retrieved successfully", success: true, data: offers });
    }

    getLatest = async (req: AuthenticatedRequest, res: Response) => {
        const offer = await this.offerRepository.getOne(await this.accessFilter(req), undefined, { sort: { createdAt: -1 } });
        return res.status(200).json({ message: "latest offer retrieved successfully", success: true, data: offer });
    }

    getone = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const offer = await this.offerRepository.getOne({ _id: offerId, ...await this.accessFilter(req) });
        if (!offer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer retrieved successfully", success: true, data: offer });
    }

    update = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const {
            createdBy: _createdBy, salesAgent: _salesAgent, offerNo: _offerNo,
            status: _status, approvedBy: _approvedBy, approvedAt: _approvedAt,
            rejectedBy: _rejectedBy, rejectedAt: _rejectedAt, rejectionReason: _rejectionReason,
            ...updateDto
        } = req.body as Partial<createDto>;
        const update = updateDto.calculationResult
            ? {
                $set: { ...updateDto, status: updateDto.calculationResult.accepted ? "draft" : "pending_approval" },
                $unset: { approvedBy: 1, approvedAt: 1, rejectedBy: 1, rejectedAt: 1, rejectionReason: 1 }
            }
            : { $set: updateDto };
        const updatedOffer = await this.offerRepository.update(
            { _id: offerId, ...this.editFilter(req) },
            update
        );
        if (!updatedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer updated successfully", success: true, data: updatedOffer });
    }

    delete = async (req: AuthenticatedRequest, res: Response) => {
        const offerId = req.params.id;
        const deletedOffer = await this.offerRepository.delete({ _id: offerId, ...this.editFilter(req) });
        if (!deletedOffer) throw new NotFoundException("offer not found");
        return res.status(200).json({ message: "offer deleted successfully", success: true, data: deletedOffer });
    }

    decide = async (req: AuthenticatedRequest, res: Response) => {
        const { decision, reason } = req.body as { decision?: "approved" | "rejected"; reason?: string };
        if (decision !== "approved" && decision !== "rejected") throw new BadRequestException("invalid decision");
        const current = await this.offerRepository.getOne({ _id: req.params.id });
        if (!current) throw new NotFoundException("offer not found");
        if (current.calculationResult.accepted) throw new BadRequestException("this offer does not need an exception");
        if (current.status !== "pending_approval" && current.status !== "draft") throw new BadRequestException("this offer has already been decided");

        const now = new Date();
        const update = decision === "approved"
            ? { $set: { status: "approved", approvedBy: new Types.ObjectId(req.user!.id), approvedAt: now }, $unset: { rejectedBy: 1, rejectedAt: 1, rejectionReason: 1 } }
            : { $set: { status: "rejected", rejectedBy: new Types.ObjectId(req.user!.id), rejectedAt: now, rejectionReason: reason?.trim() || "" }, $unset: { approvedBy: 1, approvedAt: 1 } };
        const updated = await this.offerRepository.update(
            { _id: req.params.id, status: { $in: ["pending_approval", "draft"] } },
            update
        );
        if (!updated) throw new BadRequestException("this offer has already been decided");
        return res.status(200).json({ success: true, data: updated });
    }
}
