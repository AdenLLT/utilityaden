import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const screenshots = pgTable("screenshots", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  imagePath: text("image_path"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScreenshotSchema = createInsertSchema(screenshots).pick({
  url: true,
});

export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof screenshots.$inferSelect;
