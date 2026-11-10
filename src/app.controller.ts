import { Express, NextFunction, Request, Response } from "express";
import projectRouter from "./modules/project/project.controller";
import offerRouter from "./modules/offer/offer.controller";
import { connectDb } from "./db/connection";
import cors from "cors";
import { AppError } from "./utils/error";
import mongoose from "mongoose";
import authRouter from "./modules/auth/auth.controller";
import { authenticate } from "./modules/auth/auth.middleware";
import { seedInitialAdmin } from "./modules/auth/admin.seed";

export async function bootstrap(app: Express, express: any) {
    app.use(express.json());
    await connectDb();
    await seedInitialAdmin();

    app.use(cors());
    app.get("/", (req, res) => res.status(200).json({ success: true, data: { status: "ok" } }));
    app.use("/auth", authRouter);
    app.use("/project", authenticate, projectRouter);
    app.use("/offer", authenticate, offerRouter);
    app.use((req, res) => res.status(404).json({ message: "invalid route", success: false }));
    app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
        let statusCode = error instanceof AppError ? error.statusCode : 500;
        let message = error instanceof Error ? error.message : "internal server error";
        if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) statusCode = 400;
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
            statusCode = 409;
            message = "a record with the same unique value already exists";
        }
        if (statusCode === 500) console.error(error);
        return res.status(statusCode).json({ message, success: false });
    });
}
