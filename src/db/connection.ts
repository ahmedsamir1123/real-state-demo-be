import { connect } from "mongoose";

export const connectDb = async () => {
    if (!process.env.DB_URL) throw new Error("DB_URL is not configured");
    await connect(process.env.DB_URL);
    console.log('Database connected successfully');
}
