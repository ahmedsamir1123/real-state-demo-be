import { Schema } from "mongoose";
import { IUser, userRoles } from "../../../utils/common/interfaces";

export const userSchema = new Schema<IUser>({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: userRoles },
    managerId: { type: Schema.Types.ObjectId, ref: 'user', index: true },
    refreshTokenHash: { type: String, select: false }
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform: (_document, returnedObject) => {
            delete (returnedObject as Partial<IUser>).password;
            delete (returnedObject as Partial<IUser>).refreshTokenHash;
            return returnedObject;
        }
    }
});
