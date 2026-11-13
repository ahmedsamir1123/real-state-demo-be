import { model, Schema } from "mongoose";

interface IOfferCounter {
    _id: string;
    lastNumber: number;
}

const offerCounterSchema = new Schema<IOfferCounter>({
    _id: { type: String, required: true },
    lastNumber: { type: Number, required: true, min: 1000 },
}, { versionKey: false });

export const offerCounter = model<IOfferCounter>("OfferCounter", offerCounterSchema);
