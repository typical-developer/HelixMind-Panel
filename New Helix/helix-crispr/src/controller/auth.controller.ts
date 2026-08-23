import { Request, Response } from "express";
import { z } from "zod";
import { ResetPasswordFinalInput, ResetPasswordInput, ResetPasswordVerifyOTPInput, UserCreateInput, UserLoginInput } from "../types/auth.types.js";
import colors from "colors";
import { User } from "../infrastructure/db/Schema/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Transaction, UniqueConstraintError } from "sequelize";
import { ResponseSchema } from "../types/index.js";
import { sequelize } from "../infrastructure/db/index.js";
import { event_bus } from "../services/event.service.js";
import { throw_custom_error } from "../utils/error.js";
import { verify_otp } from "../services/token.service.js";

async function login_controller(req: Request, res: Response) {
    const body = req.body;

    const validated_body: z.infer<typeof UserLoginInput> = z.parse(
        UserLoginInput,
        body
    ) as any; // Validation

    const user = await User.findOne({
        where: {
            email: validated_body.email,
        },
    });

    if (!user) {
        return res.status(401).json({
            status: "error",
            error: "Invalid email or password",
        } as ResponseSchema);
    }

    if (!bcrypt.compareSync(validated_body.password, user.password)) {
        return res.status(401).json({
            status: "error",
            error: "Invalid email or password",
        } as ResponseSchema);
    }

    user.password = undefined;

    const jwt_token = jwt.sign(
        {
            user: user.id,
        },
            process.env.TOKEN_SECRET!,
        {
            expiresIn: "2h",
        }
    );

    return res.status(200).json({
        status: "success",
        payload: {
            user: {
                "fname": user.fname,
                "lname": user.lname,
                "email": user.email,
                "createdAt": user.createdAt,
                "updatedAt": user.updatedAt
            },
            token: jwt_token,
            message: `User ${user.email} logged in successfully`,
        },
    } as ResponseSchema);
}

async function signup_controller(req: Request, res: Response) {
    const body = req.body;
    console.log(body)

    try {
        const validated_body: z.infer<typeof UserCreateInput> = z.parse(
            UserCreateInput,
            body
        ) as any; // Validate

        const new_user = User.build(validated_body);

        await new_user.save();

        return res.status(201).json({
            status: "success",
            payload: {
                message: `User ${new_user.email} has been created`,
            },
        } as ResponseSchema);
    } catch (error) {
        if (error instanceof UniqueConstraintError) {
            return res.status(409).json({
                status: "error",
                // Formats to: ["email: Invalid email", "password: Too short"]
                error: "A user already exists with this email",
            } as ResponseSchema);
        }

        throw error;
    }
}

async function forgot_password_controller(req: Request, res: Response) {
    const body = req.body;

    const validated_body: z.infer<typeof ResetPasswordInput> = z.parse(
        ResetPasswordInput, 
        body
    ) as any;

    // Fetch user and verify if user exists
    const user = await User.findOne({
        where: {
            email: validated_body.email
        }
    })

    if (!user) throw_custom_error("User doesn't exist", 404, res);

    // Send mail
    event_bus.emit("send_reset_password_mail", [validated_body.email], user.id);

    res.status(200).json({
        status: "success",
        payload: {
            message: "Forgot Password initiated"
        }
    } as ResponseSchema)
}

async function verify_reset_password_token_controller(req: Request, res: Response) {
    const body = req.body;

    const validated_body: z.infer<typeof ResetPasswordVerifyOTPInput> = z.parse(ResetPasswordVerifyOTPInput, body) as any;

    // Fetch user and verify if user exists
    const user = await User.findOne({
        where: {
            email: validated_body.email
        }
    })

    if (!user) throw_custom_error("User doesn't exist", 404, res);

    // Validate otp
    const verified_otp = await verify_otp(validated_body.otp, user.id, "reset_password");

    if (!verified_otp) {
        throw_custom_error("Unable to verify otp", 500, res);
    }

    // 3. Generate the "Proof of Verification" Token
    // Suggestion: 60s is very fast. 5 minutes (300s) is usually better 
    // to give users time to think of a secure password.
    const reset_session_token = jwt.sign({
        purpose: "password_reset_authorized",
        uid: user.id
    }, process.env.TOKEN_SECRET!, {
        expiresIn: "5m" 
    });

    res.status(200).json({
        status: "success",
        payload: {
            message: "OTP verified. You may now reset your password.",
            reset_token: reset_session_token
        }
    });
}

async function reset_password_final_controller(req: Request, res: Response) {
    const body = req.body;

    // 1. Validate input with Zod
    // Expecting { reset_token: string, new_password: string }
    const validated_body = ResetPasswordFinalInput.parse(body);

    let decoded: any;

    try {
        // 2. Verify the JWT
        decoded = jwt.verify(validated_body.reset_token, process.env.TOKEN_SECRET!);
    } catch (err) {
        // Handle expired or tampered tokens
        throw_custom_error("Reset session expired or invalid. Please start over.", 401, res);
    }

    // 3. Security Check: Ensure this token was actually meant for password reset
    if (decoded.purpose !== "password_reset_authorized") {
        throw_custom_error("Invalid token purpose", 403, res);
    }

    // 4. Find the user
    const user = await User.findByPk(decoded.uid);

    if (!user) {
        throw_custom_error("User no longer exists", 404, res);
    }

    // 5. Update the password
    // If you have a 'beforeSave' hook in your Sequelize model, 
    // it will handle the hashing automatically.
    user.password = validated_body.new_password;
    
    await user.save();

    // 6. Final Success Response
    res.status(200).json({
        status: "success",
        payload: {
            message: "Your password has been successfully reset. You can now log in."
        }
    });
}

export { login_controller, signup_controller, forgot_password_controller, verify_reset_password_token_controller, reset_password_final_controller };
