import { IUnit } from "../../utils/common/interfaces";

export type createDto = Omit<IUnit, "_id" | "createdAt" | "updatedAt">;
