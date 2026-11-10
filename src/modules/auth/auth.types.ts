import { Request } from "express";
import { UserRole } from "../../utils/common/interfaces";

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

export interface TokenPayload {
    sub: string;
    role: UserRole;
    type: "access" | "refresh";
}
