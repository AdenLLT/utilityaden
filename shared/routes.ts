import { z } from 'zod';
import { insertScreenshotSchema, screenshots } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  screenshots: {
    list: {
      method: 'GET' as const,
      path: '/api/screenshots',
      responses: {
        200: z.array(z.custom<typeof screenshots.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/screenshots',
      input: insertScreenshotSchema,
      responses: {
        201: z.custom<typeof screenshots.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/screenshots/:id',
      responses: {
        200: z.custom<typeof screenshots.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
