import { screenshots, type InsertScreenshot, type Screenshot } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getScreenshots(): Promise<Screenshot[]>;
  getScreenshot(id: number): Promise<Screenshot | undefined>;
  createScreenshot(screenshot: InsertScreenshot): Promise<Screenshot>;
  updateScreenshot(id: number, updates: Partial<Screenshot>): Promise<Screenshot>;
}

export class DatabaseStorage implements IStorage {
  async getScreenshots(): Promise<Screenshot[]> {
    return await db.select().from(screenshots).orderBy(screenshots.createdAt);
  }

  async getScreenshot(id: number): Promise<Screenshot | undefined> {
    const [screenshot] = await db.select().from(screenshots).where(eq(screenshots.id, id));
    return screenshot;
  }

  async createScreenshot(insertScreenshot: InsertScreenshot): Promise<Screenshot> {
    const [screenshot] = await db.insert(screenshots).values(insertScreenshot).returning();
    return screenshot;
  }

  async updateScreenshot(id: number, updates: Partial<Screenshot>): Promise<Screenshot> {
    const [screenshot] = await db.update(screenshots)
      .set(updates)
      .where(eq(screenshots.id, id))
      .returning();
    return screenshot;
  }
}

export const storage = new DatabaseStorage();
