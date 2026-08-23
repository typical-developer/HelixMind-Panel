import { NextFunction, Request, Response } from "express";
import { ResponseSchema } from "../types/index.js";
import jwt from "jsonwebtoken";

const auth_middleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const bearer_token = req.headers["authorization"];

        if (!bearer_token || bearer_token.replace("Bearer ", "").trim().length <= 0) {
            return res.status(401).json({
                status: "error",
                error: "Unauthorized request"
            } as ResponseSchema)
        }

        const jwt_payload = jwt.verify(bearer_token.replace("Bearer ", "").trim(), process.env.TOKEN_SECRET!) as (Record<any, any> & {
            user: string | undefined
        });

        req.headers = {...req.headers, user_id: jwt_payload.user};
        
        next();
    } catch (error) {
        return res.status(401).json({
            status: "error",
            error: "Unauthorized request"
        } as ResponseSchema)
    }
}

export {
    auth_middleware
}