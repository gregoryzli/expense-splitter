import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import groupsRoutes from "./routes/groups.routes";
import expensesRoutes from "./routes/expenses.routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/groups", groupsRoutes);
  app.use("/api/expenses", expensesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
