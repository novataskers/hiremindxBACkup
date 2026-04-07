"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MapPin, Sparkles } from "lucide-react";
import { GlobeHandle, GlobeMarker } from "./InteractiveGlobe";

interface Worker {
  id: string;
  name: string;
  headline: string;
  category: string;
  location: string;
  lat: number;
  lng: number;
  rating?: number;
  skills?: string[];
  contact?: string;
  image?: string;
  userId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  workers?: Worker[];
}

interface Props {
  globeRef: React.RefObject<GlobeHandle | null>;
  onWorkersFound?: (workers: Worker[]) => void;
  onMarkerAdd?: (marker: GlobeMarker) => void;
  onMarkersClear?: () => void;
  className?: string;
}

const categoryMap: Record<string, string> = {
  electrician: "tech", plumber: "business", carpenter: "business",
  designer: "design", developer: "tech", programmer: "tech",
  coder: "tech", writer: "writing", editor: "writing",
  marketer: "marketing", videographer: "video", photographer: "video",
  accountant: "business", lawyer: "business", cleaner: "business",
  painter: "business", mechanic: "business", welder: "business",
  tutor: "writing", teacher: "writing", translator: "writing",
  "graphic designer": "design", "web developer": "tech", "app developer": "tech",
  "social media": "marketing", "content creator": "marketing",
  "video editor": "video", "data analyst": "tech",
  "ui designer": "design", "ux designer": "design", "frontend": "tech",
  "backend": "tech", "fullstack": "tech", "mobile": "tech",
};

const CITY_COORDS: Record<string, [number, number]> = {
  "new york": [40.71, -74.01], "london": [51.51, -0.13], "paris": [48.85, 2.35],
  "berlin": [52.52, 13.41], "tokyo": [35.68, 139.69], "sydney": [-33.87, 151.21],
  "dubai": [25.20, 55.27], "mumbai": [19.08, 72.88], "beijing": [39.91, 116.39],
  "toronto": [43.65, -79.38], "chicago": [41.88, -87.63], "los angeles": [34.05, -118.24],
  "san francisco": [37.77, -122.42], "singapore": [1.35, 103.82], "seoul": [37.57, 126.98],
  "amsterdam": [52.37, 4.90], "madrid": [40.42, -3.70], "rome": [41.90, 12.50],
  "cairo": [30.04, 31.24], "lagos": [6.52, 3.38], "nairobi": [1.29, 36.82],
  "karachi": [24.86, 67.01], "istanbul": [41.01, 28.95], "moscow": [55.75, 37.62],
  "bangkok": [13.76, 100.50], "jakarta": [-6.21, 106.85], "mexico": [19.43, -99.13],
  "buenos aires": [-34.60, -58.38], "johannesburg": [-26.20, 28.04],
  "lahore": [31.55, 74.35], "islamabad": [33.72, 73.06], "delhi": [28.61, 77.21],
  "bangalore": [12.97, 77.59], "kyoto": [35.01, 135.77], "shanghai": [31.23, 121.47],
  "cape town": [-33.93, 18.42], "riyadh": [24.69, 46.72], "tehran": [35.69, 51.39],
};

function geocodeCity(city: string): [number, number] | null {
  const lower = city.toLowerCase().trim();
  for (const [name, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(name) || name.includes(lower)) return coords;
  }
  return null;
}

function parseQuery(text: string): { category: string; location: string | null } {
  const lower = text.toLowerCase();
  let category = "all";
  for (const [keyword, cat] of Object.entries(categoryMap)) {
    if (lower.includes(keyword)) { category = cat; break; }
  }
  const locMatch = lower.match(/(?:in|near|from|at|around|by)\s+([a-z\s]{2,30})(?:\s|$|,|\.)/);
  const location = locMatch ? locMatch[1].trim() : null;
  return { category, location };
}

// Dummy worker pool for testing
const DUMMY_WORKERS: Worker[] = [
  { id: "d1", name: "Alex Chen", headline: "Senior Full-Stack Developer", category: "tech", location: "San Francisco", lat: 37.77, lng: -122.42, skills: ["React", "Node.js", "TypeScript"], rating: 4.9 },
  { id: "d2", name: "Maria Garcia", headline: "UI/UX Designer", category: "design", location: "Madrid", lat: 40.42, lng: -3.70, skills: ["Figma", "CSS", "Prototyping"], rating: 4.8 },
  { id: "d3", name: "James Wilson", headline: "Backend Engineer", category: "tech", location: "London", lat: 51.51, lng: -0.13, skills: ["Python", "Django", "AWS"], rating: 4.7 },
  { id: "d4", name: "Yuki Tanaka", headline: "Mobile App Developer", category: "tech", location: "Tokyo", lat: 35.68, lng: 139.69, skills: ["Flutter", "Swift", "Kotlin"], rating: 4.9 },
  { id: "d5", name: "Sofia Müller", headline: "Content Writer & SEO", category: "writing", location: "Berlin", lat: 52.52, lng: 13.41, skills: ["SEO", "Copywriting", "Content"], rating: 4.6 },
  { id: "d6", name: "Priya Sharma", headline: "Frontend Developer", category: "tech", location: "Mumbai", lat: 19.08, lng: 72.88, skills: ["Vue.js", "React", "TailwindCSS"], rating: 4.8 },
  { id: "d7", name: "Omar Hassan", headline: "Digital Marketing Expert", category: "marketing", location: "Dubai", lat: 25.20, lng: 55.27, skills: ["Facebook Ads", "Google Ads", "Analytics"], rating: 4.7 },
  { id: "d8", name: "Lucas Silva", headline: "Video Editor & Motion Designer", category: "video", location: "Buenos Aires", lat: -34.60, lng: -58.38, skills: ["Premiere Pro", "After Effects", "DaVinci"], rating: 4.5 },
  { id: "d9", name: "Nina Kowalski", headline: "Graphic Designer", category: "design", location: "Amsterdam", lat: 52.37, lng: 4.90, skills: ["Adobe Suite", "Branding", "Illustration"], rating: 4.9 },
  { id: "d10", name: "Ahmed Al-Rashid", headline: "DevOps Engineer", category: "tech", location: "Istanbul", lat: 41.01, lng: 28.95, skills: ["Docker", "Kubernetes", "CI/CD"], rating: 4.6 },
  { id: "d11", name: "Emma Thompson", headline: "Web Developer", category: "tech", location: "Toronto", lat: 43.65, lng: -79.38, skills: ["Next.js", "PostgreSQL", "REST API"], rating: 4.8 },
  { id: "d12", name: "Arjun Patel", headline: "Data Analyst", category: "tech", location: "Bangalore", lat: 12.97, lng: 77.59, skills: ["Python", "SQL", "Tableau"], rating: 4.7 },
];

export default function GlobeAIChat({ globeRef, onWorkersFound, onMarkerAdd, onMarkersClear, className = "" }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! I can find skilled workers anywhere on the globe. Try: \"find me a web developer near London\" or \"I need a designer in Tokyo\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const { category, location } = parseQuery(text);

      let targetCoords: [number, number] | null = null;
      if (location) {
        targetCoords = geocodeCity(location);
        if (targetCoords) {
          globeRef.current?.flyTo(targetCoords[0], targetCoords[1], 2.0);
        }
      }

      // Fetch real workers first
      let allWorkers: any[] = [];
      try {
        const res = await fetch("/api/community/freelancers");
        const data = await res.json();
        allWorkers = data.freelancers || [];
      } catch {}

      // Merge with dummy workers so there's always data
      const mergedPool = [...DUMMY_WORKERS, ...allWorkers.map((w: any) => ({
        id: w.id?.toString() || String(Math.random()),
        name: w.displayName || w.name || "Worker",
        headline: w.headline || "",
        category: w.category || "all",
        location: w.location || "Global",
        lat: w.lat || 0,
        lng: w.lng || 0,
        skills: w.skills || [],
        contact: w.contactEmail || null,
        image: w.userImage || null,
        userId: w.userId,
      }))];

      // Filter by category
      let filtered = category === "all"
        ? mergedPool
        : mergedPool.filter((w) =>
            w.category === category ||
            w.skills?.some((sk: string) => sk.toLowerCase().includes(category)) ||
            w.headline?.toLowerCase().includes(category)
          );

      // If location specified, prefer workers near that location
      if (targetCoords && filtered.length > 0) {
        filtered = filtered.sort((a, b) => {
          const da = Math.abs(a.lat - targetCoords![0]) + Math.abs(a.lng - targetCoords![1]);
          const db = Math.abs(b.lat - targetCoords![0]) + Math.abs(b.lng - targetCoords![1]);
          return da - db;
        });
      }

      const workers = filtered.slice(0, 6).map((w) => {
        // Assign coords
        const locCoords = w.location ? geocodeCity(w.location) : null;
        const base: [number, number] = targetCoords || [20, 10];
        const lat = (locCoords ? locCoords[0] : (w.lat || base[0] + (Math.random() - 0.5) * 20));
        const lng = (locCoords ? locCoords[1] : (w.lng || base[1] + (Math.random() - 0.5) * 40));
        return { ...w, lat, lng };
      });

      // Place markers (golden)
      onMarkersClear?.();
      workers.forEach((w) => {
        onMarkerAdd?.({
          id: w.id,
          lat: w.lat,
          lng: w.lng,
          label: w.name,
          type: w.category,
          color: "#f5c518",
        });
      });

      onWorkersFound?.(workers);

      let reply = "";
      if (workers.length === 0) {
        reply = `I couldn't find ${category === "all" ? "workers" : category + " workers"}${location ? ` in ${location}` : ""}. Try a different search or category.`;
      } else {
        reply = `Found ${workers.length} ${category === "all" ? "professional" : category}${workers.length !== 1 ? "s" : ""}${location ? ` near ${location}` : ""}! Marked on the globe in gold.`;
        if (targetCoords) reply += ` Flying to ${location}...`;
      }

      setMessages((prev) => [...prev, { role: "assistant", text: reply, workers }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 min-h-0 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-lg ${
                msg.role === "user"
                  ? "text-black font-semibold rounded-br-none"
                  : "text-white/90 rounded-bl-none border border-white/[0.08] backdrop-blur-sm"
              }`}
              style={
                msg.role === "user"
                  ? { background: "linear-gradient(135deg, #f5c518, #c8960c)", boxShadow: "0 4px 15px rgba(245, 197, 24, 0.2)" }
                  : { background: "rgba(255,255,255,0.03)", boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)" }
              }
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl rounded-bl-sm border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.04)" }}>
              <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 shrink-0 border-t border-white/[0.06] bg-gradient-to-t from-black/20 to-transparent">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Search workers globally..."
            className="flex-1 h-12 pl-4 pr-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-1.5 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0 hover:scale-105 active:scale-95 shadow-md shadow-[#f5c518]/20"
            style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}
          >
            <Send className="w-3.5 h-3.5 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
