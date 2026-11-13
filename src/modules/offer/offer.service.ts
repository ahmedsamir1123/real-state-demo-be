import { Response } from "express";
import { Types } from "mongoose";
import { OfferRepository } from "../../db/model/offer/offer.db.service";
import { offer } from "../../db/model/offer/offer.model";
import { offerCounter } from "../../db/model/offer/offer-counter.model";
import { User } from "../../db/model/user/user.model";
import { project } from "../../db/model/project/project.model";
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

    private async applyDiscountPolicy(input: Partial<createDto>) {
        const selected = input.projectPaymentPlan;
        if (!selected) throw new BadRequestException("select a project payment plan");
        if (selected.code === "CASH") return input;
        if (!selected.sourceId || !input.project) throw new BadRequestException("select a project payment plan");
        const source = await project.findById(input.project).select("paymentPlans").lean();
        if (!source) throw new NotFoundException("project not found");
        const plan = source.paymentPlans.find((item) => String(item._id) === String(selected.sourceId));
        if (!plan) throw new BadRequestException("project payment plan not found");
        const rate = Math.max(0, Number(plan.annualDiscountRate ?? 0));
        const benefit = Math.min(100, Math.max(0, Number(plan.customerDiscountPct ?? 0)));
        const limit = rate * benefit / 100;
        const used = Number(input.customerPlan?.discountPct);
        if (!Number.isFinite(used) || used < 0) throw new BadRequestException("invalid customer discount");
        const discountLimitPassed = used <= limit + 1e-9;
        const calculationResult = input.calculationResult;
        if (!calculationResult) throw new BadRequestException("calculation result is required");
        return {
            ...input,
            projectPaymentPlan: { sourceId: selected.sourceId, name: plan.name, code: plan.code, customerBenefitPct: benefit, annualDiscountRate: rate, customerDiscountLimitPct: limit },
            financialInputs: { ...input.financialInputs!, annualDiscountRate: rate },
            calculationResult: {
                ...calculationResult,
                discountLimitPassed,
                customerDiscountLimitPct: limit,
                customerBenefitUsedPct: rate > 0 ? used / rate * 100 : (used === 0 ? 0 : 100),
                accepted: Boolean(calculationResult.accepted) && discountLimitPassed
            }
        };
    }

    private async exceptionStatus(req: AuthenticatedRequest, accepted: boolean) {
        if (accepted) return "draft";
        if (req.user!.role === "admin") return "pending_approval";
        if (req.user!.role === "manager") return "pending_manager_review";
        const creator = await User.findById(req.user!.id).select("managerId").lean();
        return creator?.managerId ? "pending_manager_review" : "pending_approval";
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
        const policy = await this.applyDiscountPolicy(req.body as createDto);
        await this.ensureOfferCounter();
        const counter = await offerCounter.findOneAndUpdate(
            { _id: "offer" },
            { $inc: { lastNumber: 1 } },
            { new: true }
        );
        if (!counter) throw new Error("Offer number counter is unavailable");
        const createDto: createDto = {
            ...policy as createDto,
            offerNo: String(counter.lastNumber),
            salesAgent: { name: req.user!.name },
            createdBy: new Types.ObjectId(req.user!.id),
            status: await this.exceptionStatus(req, Boolean(policy.calculationResult?.accepted))
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
        const current = await this.offerRepository.getOne({ _id: offerId, ...this.editFilter(req) });
        if (!current) throw new NotFoundException("offer not found");
        const {
            createdBy: _createdBy, salesAgent: _salesAgent, offerNo: _offerNo,
            status: _status, approvedBy: _approvedBy, approvedAt: _approvedAt,
            rejectedBy: _rejectedBy, rejectedAt: _rejectedAt, rejectionReason: _rejectionReason,
            managerReviewedBy: _managerReviewedBy, managerReviewedAt: _managerReviewedAt,
            managerRecommendation: _managerRecommendation, managerReviewNote: _managerReviewNote,
            ...updateDto
        } = req.body as Partial<createDto>;
        const policy = updateDto.calculationResult
            ? await this.applyDiscountPolicy({
                ...updateDto,
                project: updateDto.project || current.project,
                ...(updateDto.projectPaymentPlan || current.projectPaymentPlan ? { projectPaymentPlan: updateDto.projectPaymentPlan || current.projectPaymentPlan } : {}),
                customerPlan: updateDto.customerPlan || current.customerPlan,
                financialInputs: updateDto.financialInputs || current.financialInputs
            })
            : updateDto;
        const update = policy.calculationResult
            ? {
                $set: { ...policy, status: await this.exceptionStatus(req, Boolean(policy.calculationResult.accepted)) },
                $unset: { approvedBy: 1, approvedAt: 1, rejectedBy: 1, rejectedAt: 1, rejectionReason: 1, managerReviewedBy: 1, managerReviewedAt: 1, managerRecommendation: 1, managerReviewNote: 1 }
            }
            : { $set: policy };
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

    review = async (req: AuthenticatedRequest, res: Response) => {
        const { recommendation, note } = req.body as { recommendation?: "approved" | "rejected"; note?: string };
        if (recommendation !== "approved" && recommendation !== "rejected") throw new BadRequestException("invalid recommendation");
        const updated = await this.offerRepository.update(
            { _id: req.params.id, ...await this.accessFilter(req), status: "pending_manager_review" },
            { $set: { status: "pending_approval", managerReviewedBy: new Types.ObjectId(req.user!.id), managerReviewedAt: new Date(), managerRecommendation: recommendation, managerReviewNote: note?.trim() || "" } }
        );
        if (!updated) throw new NotFoundException("offer awaiting manager review not found");
        return res.status(200).json({ success: true, data: updated });
    }

    decide = async (req: AuthenticatedRequest, res: Response) => {
        const { decision, reason } = req.body as { decision?: "approved" | "rejected"; reason?: string };
        if (decision !== "approved" && decision !== "rejected") throw new BadRequestException("invalid decision");
        const current = await this.offerRepository.getOne({ _id: req.params.id });
        if (!current) throw new NotFoundException("offer not found");
        if (current.calculationResult.accepted) throw new BadRequestException("this offer does not need an exception");
        if (current.status !== "pending_approval") throw new BadRequestException("this offer must complete manager review before the final decision");

        const now = new Date();
        const update = decision === "approved"
            ? { $set: { status: "approved", approvedBy: new Types.ObjectId(req.user!.id), approvedAt: now }, $unset: { rejectedBy: 1, rejectedAt: 1, rejectionReason: 1 } }
            : { $set: { status: "rejected", rejectedBy: new Types.ObjectId(req.user!.id), rejectedAt: now, rejectionReason: reason?.trim() || "" }, $unset: { approvedBy: 1, approvedAt: 1 } };
        const updated = await this.offerRepository.update(
            { _id: req.params.id, status: "pending_approval" },
            update
        );
        if (!updated) throw new BadRequestException("this offer has already been decided");
        return res.status(200).json({ success: true, data: updated });
    }
}
