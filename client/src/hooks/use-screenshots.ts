import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { insertScreenshotSchema } from "@shared/schema";
import { z } from "zod";

// Validated input type based on schema
type CreateScreenshotInput = z.infer<typeof insertScreenshotSchema>;

export function useScreenshots() {
  return useQuery({
    queryKey: [api.screenshots.list.path],
    queryFn: async () => {
      const res = await fetch(api.screenshots.list.path);
      if (!res.ok) throw new Error("Failed to fetch screenshots");
      return api.screenshots.list.responses[200].parse(await res.json());
    },
    // Poll every 3 seconds to update status of pending screenshots
    refetchInterval: 3000,
  });
}

export function useScreenshot(id: number) {
  return useQuery({
    queryKey: [api.screenshots.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.screenshots.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch screenshot details");
      return api.screenshots.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateScreenshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateScreenshotInput) => {
      // Validate client-side before sending
      const validated = insertScreenshotSchema.parse(data);
      
      const res = await fetch(api.screenshots.create.path, {
        method: api.screenshots.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.screenshots.create.responses[400].parse(await res.json());
          throw new Error(error.message || "Validation failed");
        }
        throw new Error("Failed to create screenshot request");
      }
      
      return api.screenshots.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.screenshots.list.path] });
    },
  });
}
