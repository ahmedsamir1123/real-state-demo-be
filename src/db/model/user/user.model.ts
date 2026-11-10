import { model } from "mongoose";
import { IUser } from "../../../utils/common/interfaces";
import { userSchema } from "./user.schema";

export const User = model<IUser>("user", userSchema);
