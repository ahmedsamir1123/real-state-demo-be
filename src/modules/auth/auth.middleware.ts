import { NextFunction, Response } from "express";
import { User } from "../../db/model/user/user.model";
import { ForbiddenException, NotAuthException } from "../../utils/error";
import { UserRole } from "../../utils/common/interfaces";
import { verifyAccessToken } from "./auth.token";
import { AuthenticatedRequest } from "./auth.types";

export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) throw new NotAuthException("access token is required");

        const payload = verifyAccessToken(authorization.slice(7));
        const user = await User.findById(payload.sub);
        if (!user) throw new NotAuthException("user no longer exists");

        req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        next();
    } catch (error) {
        if (error instanceof NotAuthException) return next(error);
        next(new NotAuthException("invalid or expired access token"));
    }
}

export function authorize(...roles: UserRole[]) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        if (!req.user) return next(new NotAuthException("authentication is required"));
        if (!roles.includes(req.user.role)) return next(new ForbiddenException("you do not have permission to perform this action"));
        next();
    };
}
