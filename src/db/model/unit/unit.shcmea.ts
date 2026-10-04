import { Schema } from "mongoose";
import { IUnit, IUnitPricing, IUnitDetails, IUnitHold } from "../../../utils/common/interfaces";

const unitPricingSchema = new Schema<IUnitPricing>({
    pricePerMeter: { type: Number, required: true, min: 0 },
    listPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["EGP", "USD"], default: "EGP", required: true },
    addonAmount: { type: Number, default: 0, min: 0 },
    maintenancePct: { type: Number, min: 0, max: 100 }
}, { _id: false });

const unitDetailsSchema = new Schema<IUnitDetails>({
    bedrooms: { type: Number, min: 0 },
    bathrooms: { type: Number, min: 0 },
    terraceArea: { type: Number, min: 0 },
    gardenArea: { type: Number, min: 0 },
    roofArea: { type: Number, min: 0 },
    parkingSpaces: { type: Number, min: 0 }
}, { _id: false });

const unitHoldSchema = new Schema<IUnitHold>({
    isOnHold: { type: Boolean, default: false, required: true },
    reason: { type: String, trim: true },
    heldBy: { type: Schema.Types.ObjectId, ref: "User" },
    heldAt: { type: Date },
    holdUntil: { type: Date }
}, { _id: false });

export const unitSchema = new Schema<IUnit>({
    project: { type: Schema.Types.ObjectId, ref: "project", required: true, index: true },
    code: { type: String, required: true, trim: true },
    type: {
        type: String,
        required: true,
        enum: ["apartment", "villa", "townhouse", "twin_house", "chalet", "office", "clinic", "retail", "hotel_unit", "other"]
    },
    phase: { type: String, trim: true },
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    area: { type: Number, required: true, min: 0 },
    pricing: { type: unitPricingSchema, required: true },
    details: { type: unitDetailsSchema },
    status: {
        type: String,
        enum: ["available", "on_hold", "reserved", "sold", "inactive"],
        default: "available",
        required: true
    },
    hold: { type: unitHoldSchema },
    notes: { type: String, trim: true }
}, { timestamps: true, versionKey: false });

unitSchema.index({ project: 1, code: 1 }, { unique: true });
unitSchema.index({ project: 1, status: 1 });

