"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, MapPin, Sparkles } from "lucide-react";
import { GlobeHandle, GlobeMarker } from "./InteractiveGlobe";
import { toast } from "sonner";

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

interface JobData {
  description: string;
  category: string;
  location: string;
  budget: string;
  requirements: string;
  userLocation: { lat: number; lng: number } | null;
}

interface Props {
  globeRef: React.RefObject<GlobeHandle | null>;
  onWorkersFound?: (workers: Worker[]) => void;
  onMarkerAdd?: (marker: GlobeMarker) => void;
  onMarkersClear?: () => void;
  className?: string;
}

const CATEGORIES = [
  { id: "tech", name: "Technology & Programming", keywords: ["developer", "programmer", "coder", "web", "app", "software", "engineer", "data", "backend", "frontend", "fullstack", "mobile", "react", "node", "python", "java", "javascript", "typescript", "database", "api", "cloud", "devops"] },
  { id: "design", name: "Design & Creative", keywords: ["designer", "graphic", "ui", "ux", "illustrator", "logo", "branding", "web design", "creative", "artist", "photoshop", "figma", "adobe"] },
  { id: "writing", name: "Writing & Translation", keywords: ["writer", "content", "copywriter", "blog", "article", "translator", "editor", "proofreader", "seo writing", "technical writer"] },
  { id: "marketing", name: "Digital Marketing", keywords: ["marketing", "seo", "social media", "ads", "facebook", "google ads", "email marketing", "growth", "digital marketer", "content marketing"] },
  { id: "video", name: "Video & Photo", keywords: ["video", "photo", "photographer", "videographer", "video editor", "motion", "animation", "filmmaker", "youtube", "reels", "tiktok"] },
  { id: "trades", name: "Trades & Local Services", keywords: ["plumber", "electrician", "carpenter", "painter", "welder", "mechanic", "cleaner", "locksmith", "hvac", "roofer", "handyman", "repair", "installation", "construction", "maintenance"] },
  { id: "business", name: "Business & Support", keywords: ["accountant", "bookkeeper", "virtual assistant", "consultant", "business", "strategy", "admin", "data entry", "research"] },
  { id: "legal", name: "Legal & Consulting", keywords: ["lawyer", "attorney", "legal", "contract", "paralegal", "consultant", "advisor"] },
];

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
    if (lower.includes(name) || name.includes(lower)) {
      return coords;
    }
  }
  const words = lower.split(',').map(w => w.trim());
  for (const word of words) {
    for (const [name, coords] of Object.entries(CITY_COORDS)) {
      if (word.includes(name) || name.includes(word)) {
        return coords;
      }
    }
  }
  return null;
}

async function geocodingLocationAsync(location: string): Promise<[number, number] | null> {
  try {
    const syncResult = geocodeCity(location);
    if (syncResult) return syncResult;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=0`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
  return null;
}

// Smart budget extraction - handles "100", "$100", "100 dollars", "100 USD", "around 100", "up to 100", etc.
function extractBudget(text: string): string | null {
  const patterns = [
    // "$100", "$1,000", "$1000-2000", "$1000 to $2000"
    /\$([\d,]+(?:\s*-\s*[\d,]+)?)/i,
    // "100 dollars", "100 bucks", "around 100 dollars", "up to 100 dollars"
    /(?:around|about|up to|at least|starting at|from)?\s*\$?([\d,]+)\s*(?:dollars?|bucks?|usd?)/i,
    // "budget is 100", "budget: 100", "budget of $100"
    /budget(?:\s*(?:is|:|of))?\s*\$?([\d,]+)/i,
    // "100-200", "100 to 200", "between 100 and 200"
    /(?:between\s*)?([\d,]+)\s*(?:to|and|-)\s*([\d,]+)/i,
    // Standalone number that looks like a budget (after context words)
    /(?:price|cost|pay|fee|rate)(?:\s+(?:is|of|:))?\s*\$?([\d,]+)/i,
    // "negotiable", "flexible", "discuss"
    /(negotiable|flexible|discuss|open to offers|best offer)/i,
  ];
  
  const lower = text.toLowerCase();
  
  // Check for negotiable first
  if (/(negotiable|flexible|discuss|open to offers|best offer|not sure)/i.test(lower)) {
    return "Negotiable";
  }
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[1] && match[2]) {
        // Range like "100-200"
        return `$${match[1].replace(/,/g, '')} - $${match[2].replace(/,/g, '')}`;
      }
      if (match[1]) {
        const num = match[1].replace(/,/g, '');
        // Validate it's a reasonable budget number (not a year, zip code, etc)
        const n = parseInt(num);
        if (n >= 5 && n <= 1000000) {
          return `$${num}`;
        }
      }
    }
  }
  
  return null;
}

// Smart location extraction - handles "beside me", "near me", "in [city]", "close to me"
function extractLocation(text: string, userLocation: { lat: number; lng: number } | null): string | null {
  const lower = text.toLowerCase();
  
  // Check for "me" references
  const mePatterns = [
    /\b(beside|near|close to|next to|by|around)\s+(?:to\s+)?me\b/i,
    /\bmy\s+(?:location|area|place|city|town)\b/i,
    /\bwhere\s+i\s+(?:am|live|work)\b/i,
    /\bmy\s+(?:current\s+)?location\b/i,
    /\bhere\b/i,
  ];
  
  for (const pattern of mePatterns) {
    if (pattern.test(lower)) {
      return userLocation ? "My Location" : null; // Will be resolved to actual city later
    }
  }
  
  // Extract explicit location mentions
  const locationPatterns = [
    // "in London", "at New York", "from Paris"
    /(?:in|at|from|near|around|located\s+in|based\s+in)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+)?)/,
    // Location at end of sentence: "...in London."
    /(?:in|at|from|near)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)(?:\.|\s*$|\s*,)/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const loc = match[1].trim();
      // Filter out common false positives
      const falsePositives = ["the", "a", "an", "my", "this", "that", "your", "our", "their"];
      if (!falsePositives.includes(loc.toLowerCase()) && loc.length > 2) {
        return loc;
      }
    }
  }
  
  return null;
}

// Auto-detect category from job description
function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  
  for (const cat of CATEGORIES) {
    for (const keyword of cat.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return cat.id;
      }
    }
  }
  
  return null;
}

// Generate a professional job title from description
function generateJobTitle(description: string, category: string): string {
  const catInfo = CATEGORIES.find(c => c.id === category);
  const catName = catInfo ? catInfo.name.split(' & ')[0] : category;
  
  // Try to extract specific role from description
  const rolePatterns = [
    /(?:need|looking for|want|seeking)\s+(?:an?|the)?\s*([a-z\s]+?)(?:\s+(?:to|for|who|that)|\s*[,.]|$)/i,
    /(?:hire|get|find)\s+(?:an?)?\s*([a-z\s]+?)(?:\s+(?:to|for)|\s*[,.]|$)/i,
  ];
  
  for (const pattern of rolePatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const role = match[1].trim();
      if (role.length > 3 && role.length < 40) {
        return `${role.charAt(0).toUpperCase() + role.slice(1)} Needed`;
      }
    }
  }
  
  return `${catName} Services Needed`;
}

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
      text: "Hi! I'm your AI job assistant. Tell me what kind of work you need done, and I'll help you create a job post.\n\nFor example: \"I need a plumber to fix a leaky faucet near me\" or \"Looking for a web developer to build an e-commerce site, budget $2000\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [jobData, setJobData] = useState<JobData>({
    description: "",
    category: "",
    location: "",
    budget: "",
    requirements: "",
    userLocation: null,
  });
  const [conversationState, setConversationState] = useState<"collecting" | "asking_budget" | "asking_location" | "asking_category" | "confirming" | "posted">("collecting");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setJobData(prev => ({
            ...prev,
            userLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          }));
        },
        () => {} // Silently ignore
      );
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    try {
      // Prepare conversation history for the API
      const history = messages.map(m => ({
        role: m.role,
        content: m.text
      }));

      const res = await fetch("/api/community/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          jobData: jobData,
          conversationHistory: history
        })
      });

      if (!res.ok) throw new Error("Failed to get response from AI");

      const result = await res.json();
      
      if (result.error) throw new Error(result.error);

      // Check for confirmation to post (if the AI thinks it's time)
      const lowercaseMsg = result.message.toLowerCase();
      const isConfirmed = /\b(yes|post it|go ahead|confirm)\b/i.test(text) && conversationState === "confirming";

      if (isConfirmed || result.nextState === "posted") {
        // Create the job post
        const title = generateJobTitle(result.jobData.description, result.jobData.category);
        const budgetText = result.jobData.budget || "Negotiable";
        
        let fullDescription = result.jobData.description;
        fullDescription += `\n\n**Posted via AI Assistant**`;
        
        const createRes = await fetch("/api/community/projects", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title,
            description: fullDescription,
            category: result.jobData.category,
            budget: budgetText,
            location: result.jobData.location,
            skills: [result.jobData.category, result.jobData.location].filter(Boolean),
          })
        });
        
        if (createRes.ok) {
          setConversationState("posted");
          setJobData(result.jobData);
          setMessages(prev => [...prev, { 
            role: "assistant", 
            text: `✅ **Job posted successfully!**\n\nYour job "${title}" has been posted.\n\nWould you like to post another? Just start describing it!`
          }]);
          toast.success("Job posted successfully!");
          return;
        }
      }

      // Update state with new job data from AI
      setJobData(result.jobData);
      setConversationState(result.nextState);
      
      // Add AI response to chat
      setMessages(prev => [...prev, { 
        role: "assistant", 
        text: result.message 
      }]);

    } catch (err) {
      console.error("AI Chat Error:", err);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        text: "I'm having a little trouble right now. Could you please try again?" 
      }]);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      await handleSendMessage(text);
    } catch (err) {
      console.error("Error in handleSend:", err);
      setMessages((prev) => [...prev, { role: "assistant", text: "I'm having trouble understanding. Could you rephrase that?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full relative ${className}`}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 min-h-0 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-lg whitespace-pre-wrap ${
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

      <div className="px-4 pb-6 pt-2 shrink-0 border-t border-white/[0.06] bg-gradient-to-t from-black/20 to-transparent">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={conversationState === "collecting" ? "Describe the work you need done..." : "Reply to the AI assistant..."}
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
