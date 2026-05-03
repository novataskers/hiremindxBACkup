"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Crown, AlertCircle } from "lucide-react";

export function UsageLimitModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      
      if (response.status === 429) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          if (data && data.limitReached) {
            window.dispatchEvent(
              new CustomEvent("usage-limit-reached", { 
                detail: { message: data.error || "You have reached your usage limit for this feature." }
              })
            );
          }
        } catch (e) {
          // Ignore json parse errors for non-json responses
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const handleLimitReached = (e: Event) => {
      const customEvent = e as CustomEvent;
      setMessage(customEvent.detail?.message || "You have reached your usage limit for this feature.");
      setOpen(true);
    };

    window.addEventListener("usage-limit-reached", handleLimitReached);
    return () => window.removeEventListener("usage-limit-reached", handleLimitReached);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md border-white/10 bg-zinc-950/95 backdrop-blur-xl text-white">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <DialogTitle className="text-center text-xl font-semibold">Usage Limit Reached</DialogTitle>
          <DialogDescription className="text-center text-zinc-400 mt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-3 mt-6">
          <Button 
            className="w-full bg-white text-black hover:bg-zinc-200" 
            onClick={() => {
              setOpen(false);
              router.push("/premium");
            }}
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </Button>
          <Button 
            variant="ghost" 
            className="w-full text-zinc-400 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
