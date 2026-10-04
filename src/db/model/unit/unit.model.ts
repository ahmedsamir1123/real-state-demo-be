import { model } from "mongoose";
import { IUnit } from "../../../utils/common/interfaces";
import { unitSchema } from "./unit.shcmea";

export const unit = model<IUnit>("unit", unitSchema);
