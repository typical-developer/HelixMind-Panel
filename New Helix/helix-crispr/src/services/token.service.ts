import { UniqueConstraintError } from "sequelize";
import { Token } from "../infrastructure/db/Schema/Token.js";
import { throw_custom_error } from "../utils/error.js";
import bcrypt from "bcryptjs";
import { sequelize } from "../infrastructure/db/index.js";

const generate_otp = function() {
    return (Math.ceil(Math.random() * 900000) + 100000)
}

const max_token_gen_count = 5;

const create_otp = async function(purpose: "confirm_email" | "reset_password" | "default", reference_id: string, options: {
    expires_at?: Date,
    single_use: boolean
} = {
    single_use: true
}): Promise<string> {
    var tries = 0;
    var token;

    while (true) {
        try {
            token = generate_otp().toString();

            const new_token = await Token.build({
                token: token,
                purpose: purpose,
                reference_id: reference_id,
                ...options.expires_at ? { expires_at: options.expires_at } : {},
                single_use: options.single_use
            });

            await new_token.save();

            break;
        } catch (error) {
            tries++;
            if (error instanceof UniqueConstraintError && (tries <= max_token_gen_count)) {
                continue;
            }

            console.error(error);
            throw_custom_error("Unable to generate token, something went wrong, try again")
        }  
    }

    return token;
}

const verify_otp = async function (token: string, reference_id: string, purpose: "confirm_email" | "reset_password") {
    const transaction = await sequelize.transaction();

    try {
        const token_from_db = await Token.findOne({
            where: {
                reference_id,
                purpose
            },
            order: [
                ['updated_at', 'DESC'] 
            ],
            transaction
        });

        if (!token_from_db) {
            throw_custom_error("Token not found", 404)
        }

        if (token_from_db.expires_at.getTime() < Date.now()) {
            throw_custom_error("Token has expired, request new token", 400);
        }

        if (!bcrypt.compareSync(token, token_from_db.token)) {
            throw_custom_error("Invalid token", 401);
        }

        if (token_from_db.single_use) {
            await Token.destroy({
                where: {
                    id: token_from_db.id
                },
                transaction
            })
        }

        await transaction.commit();
        return true;
    } catch (error) {
        if (transaction) await transaction.rollback();

        if (error instanceof Error && error.message.startsWith("Custom Error: ")) {
            throw error
        }

        throw_custom_error(error instanceof Error ? error.message : "Something went wrong");
    }
}

export {
    generate_otp,
    create_otp,
    verify_otp
}