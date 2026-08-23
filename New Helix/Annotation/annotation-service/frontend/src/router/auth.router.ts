import { Request, Response, Router } from "express";
import { forgot_password_controller, login_controller, reset_password_final_controller, signup_controller, verify_reset_password_token_controller } from "../controller/auth.controller.js";
import { handle_error } from "../utils/error.js";

const auth_router = Router();

auth_router.post("/login", async (req: Request, res: Response) => {
    try {
        await login_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

auth_router.post("/signup", async (req: Request, res: Response) => {
    try {
        await signup_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

auth_router.post("/forgot-password", async (req: Request, res: Response) => {
    try {
        await forgot_password_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

auth_router.post("/verify-password-reset", async (req: Request, res: Response) => {
    try {
        await verify_reset_password_token_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

auth_router.post("/reset-password", async (req: Request, res: Response) => {
    try {
        // This is the newest controller we discussed that takes 
        // the reset_token and the new_password
        await reset_password_final_controller(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

export {
    auth_router
}