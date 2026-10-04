import { IOffer } from "../../utils/common/interfaces";

export type createDto = Omit<IOffer, "createdAt" | "updatedAt">;
