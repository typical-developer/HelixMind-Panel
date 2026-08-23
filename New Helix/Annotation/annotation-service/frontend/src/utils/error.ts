import { Response } from "express";
import { ZodError } from "zod";
import { ResponseSchema } from "../types/index.js";

function handle_error(error: any, res: Response) {
  if (error instanceof ZodError) {
    const error_message: string[] = [];

    const keys = Object.keys(error.format());

    Object.values(error.format()).forEach((error, i) => {
      if (!Array.isArray(error) && error["_errors"]) {
        error_message.push((error["_errors"] as string[]).join(", "));
      }
    });

    return res.status(400).json({
      status: "error",
      // Formats to: ["email: Invalid email", "password: Too short"]
      error: error_message.join(", "),
    } as ResponseSchema);
  }

  const error_message: string = error instanceof Error ? error.message : JSON.stringify(error);

  if (error_message.startsWith("Custom Error: ")) {
    const code = error_message.split(" ---- code: Server Error ")[1] ?? 500;
    const message = (error_message.split(" ---- code: Server Error ")[0] ?? "").replace("Custom Error: ", "").trim();
    
    return res.status(parseInt(code)).json({
      status: "error",
      error: message,
    } as ResponseSchema);;
  }

  res.status(500).json({
    status: "error",
    error: error_message,
  } as ResponseSchema);
}

function throw_custom_error(message: string, code: number = 500, res?: Response) {
  if (code == 200 || code == 201) throw new Error("Something went wrong");

  if (res) {
    return res.status(code).json({
      status: "error",
      error: message
    } as ResponseSchema);
  }

  throw new Error(`Custom Error: ${message} ---- code: Server Error ${code}`)
}

export { handle_error, throw_custom_error };
