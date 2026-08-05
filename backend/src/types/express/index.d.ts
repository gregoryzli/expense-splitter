import type { Group } from "@prisma/client";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      group?: Group;
    }
  }
}

export {};
