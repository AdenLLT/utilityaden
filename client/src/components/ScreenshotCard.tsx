import { Screenshot } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Clock, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ScreenshotCardProps {
  screenshot: Screenshot;
}

export function ScreenshotCard({ screenshot }: ScreenshotCardProps) {
  const isPending = screenshot.status === "pending";
  const isFailed = screenshot.status === "failed";
  const isCompleted = screenshot.status === "completed";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300"
    >
      {/* Status Indicator Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 z-10 
        ${isPending ? "bg-amber-400 animate-pulse" : ""}
        ${isFailed ? "bg-red-500" : ""}
        ${isCompleted ? "bg-emerald-500" : ""}
      `} />

      <div className="aspect-video w-full bg-muted/50 relative overflow-hidden flex items-center justify-center">
        {isCompleted && screenshot.imagePath ? (
          <a href={screenshot.imagePath} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-zoom-in">
            <img 
              src={screenshot.imagePath} 
              alt={`Screenshot of ${screenshot.url}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </a>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
            {isPending && (
              <>
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
                <span className="text-sm font-medium">Capturing...</span>
              </>
            )}
            {isFailed && (
              <>
                <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                <span className="text-sm font-medium text-destructive">Failed to capture</span>
              </>
            )}
            {!isPending && !isFailed && !isCompleted && (
              <ImageIcon className="w-8 h-8 opacity-20" />
            )}
          </div>
        )}

        {/* Overlay Actions */}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 pointer-events-none" />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <a 
            href={screenshot.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm font-medium leading-none hover:text-primary hover:underline truncate flex-1 block font-mono"
            title={screenshot.url}
          >
            {new URL(screenshot.url).hostname}
            <span className="opacity-50 font-normal ml-0.5">{new URL(screenshot.url).pathname}</span>
          </a>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </div>
        
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            {isFailed && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
            {isPending && <Clock className="w-3.5 h-3.5 animate-pulse text-amber-500" />}
            <span className="capitalize">{screenshot.status}</span>
          </div>
          
          {screenshot.createdAt && (
            <time dateTime={new Date(screenshot.createdAt).toISOString()}>
              {formatDistanceToNow(new Date(screenshot.createdAt), { addSuffix: true })}
            </time>
          )}
        </div>
        
        {isFailed && screenshot.error && (
          <p className="mt-2 text-xs text-destructive bg-destructive/5 p-2 rounded border border-destructive/10">
            {screenshot.error}
          </p>
        )}
      </div>
    </motion.div>
  );
}
