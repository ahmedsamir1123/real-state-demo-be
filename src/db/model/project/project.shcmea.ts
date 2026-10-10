import { Schema } from "mongoose";
import { IProject, IFinancialPolicy, IProjectPaymentPlan, IMilestone, IInstallmentSegment } from "../../../utils/common/interfaces";

const financialPolicySchema = new Schema<IFinancialPolicy>({
        annualDiscountRate: { type: Number },       // معدل NPV %
        handoverMonth: { type: Number },            // الاستلام بعد كام شهر
        requiredCollectionPct: { type: Number },    // المطلوب تحصيله عند الاستلام %
        maintenancePct: { type: Number }


})

const milestoneSchema = new Schema<IMilestone>({
        installmentNumber: { type: Number, min: 1 },
        month: { type: Number, min: 0 },
        percentage: { type: Number, required: true, min: 0, max: 100 },
        spreadOverYearInstallments: { type: Boolean, default: false }
}, { _id: false });

const installmentSegmentSchema = new Schema<IInstallmentSegment>({
        fromInstallment: { type: Number, min: 1 },
        toInstallment: { type: Number, min: 1 },
        fromYear: { type: Number, min: 1 },
        toYear: { type: Number, min: 1 },
        installmentAmount: { type: Number, required: true, min: 0 }
}, { _id: false });

const projectPaymentPlanSchema = new Schema<IProjectPaymentPlan>({
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, trim: true, uppercase: true },
        isActive: { type: Boolean, default: true },
        isDefault: { type: Boolean, default: false },
        discountPct: { type: Number, default: 0, min: 0, max: 100 },
        downPaymentPct: { type: Number, required: true, min: 0, max: 100 },
        years: { type: Number, required: true, min: 0.25 },
        frequencyMonths: { type: Number, required: true, enum: [1, 3, 6, 12], default: 3 },
        installmentDistribution: { type: String, enum: ["level", "front_loaded", "back_loaded"], default: "level" },
        loadFactorPct: { type: Number, min: 0, max: 95, default: 20 },
        milestones: { type: [milestoneSchema], default: [] },
        installmentSegments: { type: [installmentSegmentSchema], default: [] },
        settleDifferenceAtYearEnd: { type: Boolean, default: false }
});

export const projectSchema = new Schema<IProject>({
        name: { type: String, required: true },

        code: { type: String, required: true },
        location: { type: String, required: true },

        status: { type: String, enum: ["active", "inactive"] }, // active | inactive
        description: { type: String },
        financialPolicy: { type: financialPolicySchema },
        paymentPlans: { type: [projectPaymentPlanSchema], default: [] },


}, {
        timestamps: true,
        versionKey: false
})

projectSchema.pre("validate", function () {
        const plans = this.paymentPlans || [];
        if (!plans.length) this.invalidate("paymentPlans", "at least one payment plan is required");
        const normalizedCodes = plans.map((plan) => plan.code.trim().toUpperCase());
        if (new Set(normalizedCodes).size !== normalizedCodes.length) this.invalidate("paymentPlans", "payment plan codes must be unique per project");
        if (plans.length && !plans.some((plan) => plan.isActive)) this.invalidate("paymentPlans", "at least one payment plan must be active");
        if (plans.length && plans.filter((plan) => plan.isDefault).length !== 1) this.invalidate("paymentPlans", "exactly one payment plan must be the default");
        if (plans.some((plan) => plan.isDefault && !plan.isActive)) this.invalidate("paymentPlans", "the default payment plan must be active");
        for (const plan of plans) {
                const installmentsCount = Math.max(1, Math.round((plan.years * 12) / plan.frequencyMonths));
                const milestoneInstallment = (milestone: IMilestone) => milestone.installmentNumber
                        ?? Math.max(1, Math.round((milestone.month ?? plan.frequencyMonths) / plan.frequencyMonths));
                const segmentStart = (segment: IInstallmentSegment) => segment.fromInstallment
                        ?? Math.max(1, Math.round((((segment.fromYear ?? 1) - 1) * 12) / plan.frequencyMonths) + 1);
                const segmentEnd = (segment: IInstallmentSegment) => segment.toInstallment
                        ?? Math.max(1, Math.round(((segment.toYear ?? 1) * 12) / plan.frequencyMonths));
                const allocatedPercentage = plan.downPaymentPct + plan.milestones.reduce((sum, milestone) => sum + milestone.percentage, 0);
                if (allocatedPercentage > 100) this.invalidate("paymentPlans", `payment plan ${plan.code} allocates more than 100%`);
                if (plan.milestones.some((milestone) => milestoneInstallment(milestone) > installmentsCount)) {
                        this.invalidate("paymentPlans", `payment plan ${plan.code} has a milestone outside its installment count`);
                }
                if (plan.installmentSegments.some((segment) => segmentStart(segment) > segmentEnd(segment) || segmentEnd(segment) > installmentsCount)) {
                        this.invalidate("paymentPlans", `payment plan ${plan.code} has an invalid installment segment`);
                }
        }
});
