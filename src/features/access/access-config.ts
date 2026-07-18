import { z } from "zod";

const accessConfigSchema = z.object({
  APP_ACCESS_KEY: z.string().min(8),
  APP_SESSION_SECRET: z.string().min(32),
});

export function getAccessConfig() {
  return accessConfigSchema.safeParse({
    APP_ACCESS_KEY: process.env.APP_ACCESS_KEY,
    APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
  });
}
