import bcrypt from "bcryptjs";
import { User } from "../../db/model/user/user.model";

export async function seedInitialAdmin() {
    const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Ahmed";

    if (!email || !password) return;
    if (password.length < 8) throw new Error("INITIAL_ADMIN_PASSWORD must be at least 8 characters");

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        existingUser.name = name;
        existingUser.role = "admin";
        existingUser.password = await bcrypt.hash(password, 12);
        await existingUser.save();
        console.log(`Initial admin synchronized: ${email}`);
        return;
    }

    await User.create({
        name,
        email,
        password: await bcrypt.hash(password, 12),
        role: "admin"
    });
    console.log(`Initial admin created: ${email}`);
}
