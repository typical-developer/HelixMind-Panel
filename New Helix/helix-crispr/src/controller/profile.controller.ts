import { Request, Response } from "express";
import { throw_custom_error } from "../utils/error.js";
import { User } from "../infrastructure/db/Schema/User.js";
import { ResponseSchema } from "../types/index.js";
import { email } from "zod";

const verify_user = async (req: Request, res: Response) => {
    const user_id = req.headers.user_id as string | undefined;

    if (!user_id) {
        return throw_custom_error("User not found", 404, res);
    }

    const user = await User.findOne({
        where: {
            id: user_id
        }
    })

    if (!user) {
        return throw_custom_error("User not found", 404, res);
    }

    user.password = undefined, user.id = "";

    res.status(200).json({
        status: "success",
        payload: {
            "fname": user.fname,
            "lname": user.lname,
            "email": user.email,
            "createdAt": user.createdAt,
            "updatedAt": user.updatedAt
        }
    } as ResponseSchema)
}

export {
    verify_user
}