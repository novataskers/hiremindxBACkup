"use client";

import { Layers3 } from "lucide-react";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Layers3 className="w-6 h-6 text-primary" />
      <span className="text-xl font-bold tracking-tight">HIREMINDX</span>
    </div>
  );
}
