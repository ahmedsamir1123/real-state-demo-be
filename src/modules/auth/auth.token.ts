import jwt, { SignOptions } from "jsonwebtoken";
import { TokenPayload } from "./auth.types";
import { UserRole } from "../../utils/common/interfaces";

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
    const secret = process.env[name];
    if (!secret || secret.length < 32) throw new Error(`${name} must be configured with at least 32 characters`);
    return secret;
}

function signToken(
    userId: string,
    role: UserRole,
    type: TokenPayload["type"],
    secret: string,
    expiresIn: NonNullable<SignOptions["expiresIn"]>
) {
    const options: SignOptions = {
        subject: userId,
        expiresIn,
        algorithm: "HS256"
    };
    return jwt.sign({ role, type }, secret, options);
}

export function createAccessToken(userId: string, role: UserRole) {
    return signToken(userId, role, "access", getSecret("JWT_ACCESS_SECRET"), "15m");
}

export function createRefreshToken(userId: string, role: UserRole) {
    return signToken(userId, role, "refresh", getSecret("JWT_REFRESH_SECRET"), "7d");
}

export function verifyAccessToken(token: string) {
    return verifyToken(token, "access", getSecret("JWT_ACCESS_SECRET"));
}

export function verifyRefreshToken(token: string) {
    return verifyToken(token, "refresh", getSecret("JWT_REFRESH_SECRET"));
}

function verifyToken(token: string, expectedType: TokenPayload["type"], secret: string): TokenPayload {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub || payload.type !== expectedType) {
        throw new Error("invalid token");
    }
    return { sub: payload.sub, role: payload.role as UserRole, type: payload.type };
}
