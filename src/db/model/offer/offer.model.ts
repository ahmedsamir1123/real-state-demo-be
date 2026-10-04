import { model } from "mongoose";
import { IOffer } from "../../../utils/common/interfaces";
import { offerSchema } from "./offer.shcmea";

export const offer = model<IOffer>("offer", offerSchema);