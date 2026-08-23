import express, { Request, Response } from "express";
import { auth_router } from "./router/auth.router.js";
import colors from "colors";
import cors from "cors";

// Remove when the entire architecture is set up
import dotenv from "dotenv";
dotenv.config();

import "./infrastructure/db/index.js";
import { profile_router } from "./router/profile.router.js";
import { auth_middleware } from "./middlewares/auth.middleware.js";
import { ResponseSchema } from "./types/index.js";
import { fastaRouters } from "./router/fastas.router.js";
import { simRouter } from "./router/simulation.router.js";
// import { generate_otp } from "./services/token.service.js";

const app = express();

const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:8080",
  "https://helix-frontend-v2.vercel.app",
  "https://helix-frontend.vercel.app",
  "http://localhost:3000"
];

const corsOptions = {
  origin: function (origin: any, callback: (...x: any[]) => any) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

// Apply CORS BEFORE body parsers
app.use(cors(corsOptions));

// Increase payload size limits (adjust as needed)
app.use(express.json({ limit: '50mb' })); // Increased from default 100kb
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Error handler for payload too large
app.use((err: any, req: Request, res: Response, next: any) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      status: "error",
      error: "Payload too large. Maximum size is 50MB."
    } as ResponseSchema);
  }
  next(err);
});

app.get("/api/v1/ping", async (req: Request, res: Response) => {
  res.send(`Hello, World!`);
});

// app.get("/api/v1/test_mail_service", async (req: Request, res: Response) => {
//   try {
//     await send_mail("reset-password", ["reremie523@gmail.com", "nzenwatachristopher186@gmail.com", "kidly204@gmail.com"], {
//       otp_code: 842931,
//       support_mail: "helix@traction3.com"
//     });
    
//     res.status(200).json({
//       status: "success",
//       payload: {
//         message: "Mailer working",
//       }
//     } as ResponseSchema);
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       error: error instanceof Error ? error.message : JSON.stringify(error),
//     } as ResponseSchema);
//   }
// });

app.use("/api/v1/auth", auth_router);

app.use(auth_middleware);
app.use("/api/v1/simulation", simRouter);
app.use("/api/v1/fastas", fastaRouters)
app.use("/api/v1/me", profile_router);

app.listen(PORT, () => {
  console.log(colors.green(`Server is running on http://localhost:${PORT}`));
});