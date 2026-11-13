import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { User } from "../../db/model/user/user.model";
import { Types } from "mongoose";
import { BadRequestException, NotAuthException } from "../../utils/error";
import { userRoles, UserRole } from "../../utils/common/interfaces";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "./auth.token";
import { AuthenticatedRequest } from "./auth.types";

const hashRefreshToken = (token: string) => createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function publicUser(user: { id: string; name: string; email: string; role: UserRole; managerId?: Types.ObjectId }) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, managerId: user.managerId ? String(user.managerId) : null };
}

async function issueTokens(user: { id: string; role: UserRole }) {
    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = createRefreshToken(user.id, user.role);
    await User.updateOne({ _id: user.id }, { refreshTokenHash: hashRefreshToken(refreshToken) });
    return { accessToken, refreshToken };
}

export class AuthService {
    login = async (req: Request, res: Response) => {
        const { email, password } = req.body as { email?: string; password?: string };
        if (!email || !password) throw new BadRequestException("email and password are required");

        const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new NotAuthException("invalid email or password");
        }

        const tokens = await issueTokens(user);
        return res.status(200).json({ success: true, data: { user: publicUser(user), ...tokens } });
    };

    refresh = async (req: Request, res: Response) => {
        const { refreshToken } = req.body as { refreshToken?: string };
        if (!refreshToken) throw new BadRequestException("refreshToken is required");

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            throw new NotAuthException("invalid or expired refresh token");
        }

        const user = await User.findById(payload.sub).select("+refreshTokenHash");
        if (!user?.refreshTokenHash || user.refreshTokenHash !== hashRefreshToken(refreshToken)) {
            throw new NotAuthException("refresh token has been revoked");
        }

        const tokens = await issueTokens(user);
        return res.status(200).json({ success: true, data: tokens });
    };

    logout = async (req: AuthenticatedRequest, res: Response) => {
        await User.updateOne({ _id: req.user!.id }, { $unset: { refreshTokenHash: 1 } });
        return res.status(200).json({ success: true, message: "logged out successfully" });
    };

    me = async (req: AuthenticatedRequest, res: Response) => {
        return res.status(200).json({ success: true, data: req.user });
    };

    createUser = async (req: Request, res: Response) => {
        const { name, email, password, role, managerId } = req.body as {
            name?: string; email?: string; password?: string; role?: UserRole; managerId?: string;
        };
        if (!name?.trim() || !email || !password || !role) {
            throw new BadRequestException("name, email, password and role are required");
        }
        if (!userRoles.includes(role)) throw new BadRequestException("invalid user role");
        if (password.length < 8) throw new BadRequestException("password must be at least 8 characters");
        if (managerId && role !== "sales") throw new BadRequestException("only sales users can have a manager");
        if (managerId && !Types.ObjectId.isValid(managerId)) throw new BadRequestException("invalid manager id");
        if (managerId && !await User.exists({ _id: managerId, role: "manager" })) throw new BadRequestException("manager not found");

        const user = await User.create({
            name: name.trim(),
            email: normalizeEmail(email),
            password: await bcrypt.hash(password, 12),
            role,
            ...(managerId ? { managerId: new Types.ObjectId(managerId) } : {})
        });
        return res.status(201).json({ success: true, message: "user created successfully", data: publicUser(user) });
    };

    listUsers = async (_req: AuthenticatedRequest, res: Response) => {
        const users = await User.find().sort({ name: 1 });
        return res.status(200).json({ success: true, data: users.map(publicUser) });
    };

    assignManager = async (req: AuthenticatedRequest, res: Response) => {
        const { managerId } = req.body as { managerId?: string | null };
        if (managerId && !Types.ObjectId.isValid(managerId)) throw new BadRequestException("invalid manager id");
        if (managerId && !await User.exists({ _id: managerId, role: "manager" })) throw new BadRequestException("manager not found");
        if (!Types.ObjectId.isValid(req.params.id as string)) throw new BadRequestException("invalid user id");
        const user = await User.findOneAndUpdate(
            { _id: req.params.id, role: "sales" },
            managerId ? { $set: { managerId: new Types.ObjectId(managerId) } } : { $unset: { managerId: 1 } },
            { new: true }
        );
        if (!user) throw new BadRequestException("sales user not found");
        return res.status(200).json({ success: true, data: publicUser(user) });
    };
}
