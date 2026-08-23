import { z } from "zod";

const UserCreateInput = z.object({
    fname: z.string().min(2).max(100),
    lname: z.string().min(2).max(100),
    email: z.email().max(255),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, "Password too weak, one digit, one special character, one uppercase and one lowercase character needed")
})

const UserLoginInput = z.object({
    email: z.email().max(255),
    password: z.string()
})

const ResetPasswordInput = z.object({
    email:  z.email().max(255)
})

const ResetPasswordVerifyOTPInput = z.object({
    otp: z.string().min(6, "Invalid OTP"),
    email:  z.email().max(255)
})

const ResetPasswordFinalInput = z.object({
    // The JWT received from the verify-otp step
    reset_token: z.string("Reset token is required"),
    
    // The new password with basic security requirements
    new_password: z
        .string("New password is required")
        .min(8, "Password must be at least 8 characters long")
        .max(100, "Password is too long"),

    // Optional but recommended: confirm field to prevent typos
    confirm_password: z.string("Please confirm your password"),
}).refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"], // This highlights the error on the confirm field
});

// Type helper for your controller
type ResetPasswordFinalInputType = z.infer<typeof ResetPasswordFinalInput>;

export {
    UserCreateInput,
    UserLoginInput,
    ResetPasswordInput,
    ResetPasswordVerifyOTPInput,
    ResetPasswordFinalInput,
    ResetPasswordFinalInputType
}