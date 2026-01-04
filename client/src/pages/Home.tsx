import { useScreenshots } from "@/hooks/use-screenshots";
import { ScreenshotCard } from "@/components/ScreenshotCard";
import { CaptureForm } from "@/components/CaptureForm";
import { Loader2, Layers } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: screenshots, isLoading, isError } = useScreenshots();

  return (
    <div className="min-h-screen bg-background relative selection:bg-primary/10 selection:text-primary">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <main className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/5 text-primary mb-4"
          >
            <Layers className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground"
          >
            Capture the Web
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Instant, high-quality website screenshots. Just enter a URL and let our automation handle the rest.
          </motion.p>
        </div>

        {/* Action Area */}
        <CaptureForm />

        {/* Results Grid */}
        <div className="mt-16 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Captures</h2>
            {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-4 animate-pulse">
                  <div className="aspect-video bg-muted rounded-lg" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 rounded-2xl bg-destructive/5 border border-destructive/10">
              <p className="text-destructive font-medium">Failed to load screenshots</p>
              <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page</p>
            </div>
          ) : !screenshots?.length ? (
            <div className="text-center py-24 rounded-2xl border border-dashed border-border/60 bg-card/30">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No screenshots yet</h3>
              <p className="text-muted-foreground mt-1">Enter a URL above to capture your first one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {screenshots.map((screenshot) => (
                <ScreenshotCard key={screenshot.id} screenshot={screenshot} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
