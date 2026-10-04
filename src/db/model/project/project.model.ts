import { model } from "mongoose";
import { IProject } from "../../../utils/common/interfaces";
import { projectSchema } from "./project.shcmea";

export const project = model<IProject>("project", projectSchema);