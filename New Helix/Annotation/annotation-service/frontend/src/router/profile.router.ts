import { Request, Response, Router } from "express";
import { verify_user } from "../controller/profile.controller.js";
import { handle_error } from "../utils/error.js";

const profile_router = Router();

profile_router.get("/auth", async (req: Request, res: Response) => {
    try {
        await verify_user(req, res);
    } catch (error) {
        handle_error(error, res);
    }
});

export {
    profile_router,
}
