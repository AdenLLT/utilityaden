import { useState } from "react";
import { useCreateScreenshot } from "@/hooks/use-screenshots";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Aperture, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function CaptureForm() {
  const [url, setUrl] = useState("");
  const { mutate, isPending } = useCreateScreenshot();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic URL validation helper
    let submitUrl = url.trim();
    if (!submitUrl) return;
    
    if (!submitUrl.startsWith('http://') && !submitUrl.startsWith('https://')) {
      submitUrl = `https://${submitUrl}`;
    }

    mutate(
      { url: submitUrl },
      {
        onSuccess: () => {
          setUrl("");
          toast({
            title: "Screenshot request started",
            description: "We're capturing that page now. It should appear shortly.",
          });
        },
        onError: (error) => {
          toast({
            title: "Error starting capture",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel rounded-2xl p-2 shadow-lg shadow-black/5 ring-1 ring-black/5"
      >
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Aperture className={`w-5 h-5 ${isPending ? 'animate-spin' : ''}`} />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter website URL (e.g. google.com)"
              className="w-full pl-12 pr-4 h-12 sm:h-14 bg-transparent rounded-xl text-base sm:text-lg outline-none placeholder:text-muted-foreground/50 focus:bg-secondary/50 transition-colors"
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !url.trim()}
            className="
              h-12 sm:h-14 px-6 sm:px-8 rounded-xl font-medium text-white whitespace-nowrap
              bg-primary hover:bg-primary/90 
              shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
              transition-all duration-200 ease-out flex items-center justify-center gap-2
            "
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Capturing...</span>
              </>
            ) : (
              <>
                <span>Capture</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
      <motion.p 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ delay: 0.3 }}
        className="text-center text-xs text-muted-foreground mt-4"
      >
        Supports full-page capture. Processing typically takes 5-10 seconds.
      </motion.p>
    </div>
  );
}
