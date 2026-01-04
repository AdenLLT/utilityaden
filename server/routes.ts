import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { captureScreenshot } from "./puppeteer";
import express from 'express';
import path from 'path';

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Serve uploaded screenshots
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get(api.screenshots.list.path, async (req, res) => {
    const screenshots = await storage.getScreenshots();
    res.json(screenshots);
  });

  app.get(api.screenshots.get.path, async (req, res) => {
    const screenshot = await storage.getScreenshot(Number(req.params.id));
    if (!screenshot) {
      return res.status(404).json({ message: 'Screenshot not found' });
    }
    res.json(screenshot);
  });

  app.post(api.screenshots.create.path, async (req, res) => {
    try {
      const input = api.screenshots.create.input.parse(req.body);
      
      // Create pending record
      const screenshot = await storage.createScreenshot(input);
      
      // Trigger screenshot capture in background
      captureScreenshot(screenshot.id, input.url)
        .then(async (imagePath) => {
          await storage.updateScreenshot(screenshot.id, {
            status: 'completed',
            imagePath: `/uploads/${path.basename(imagePath)}`
          });
        })
        .catch(async (error) => {
          console.error("Screenshot capture failed:", error);
          await storage.updateScreenshot(screenshot.id, {
            status: 'failed',
            error: error.message
          });
        });

      res.status(201).json(screenshot);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  return httpServer;
}

// Seed function if needed (not strictly required for this simple app but good practice)
async function seedDatabase() {
  const existing = await storage.getScreenshots();
  if (existing.length === 0) {
    // maybe add a dummy entry?
  }
}
