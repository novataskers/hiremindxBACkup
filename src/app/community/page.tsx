"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { 
  Plus, Search, Filter, Star, MapPin, Clock, Briefcase, Users, Zap, MessageCircle, ArrowRight, ChevronRight, Code, Palette, Edit3, Megaphone, BarChart3, Video, Globe, LayoutGrid, List as ListIcon, ArrowLeft, User, DollarSign, Image as ImageIcon, Link as LinkIcon, X, Upload, Loader2, Tag, Package, Check, FileText, Send, Layers3, Phone, Paperclip, ExternalLink, CheckCheck, Target, Wrench, HardHat, Scale, Bell, Settings, Trash2, MoreVertical, FileSignature, CreditCard, Wallet, AlertTriangle, Shield, Banknote, Building2, ArrowDownToLine, BadgePoundSterling
} from "lucide-react";
import type { GlobeHandle, GlobeMarker } from "@/components/InteractiveGlobe";

const InteractiveGlobe = dynamic(() => import("@/components/InteractiveGlobe"), { ssr: false });
const GlobeAIChat = dynamic(() => import("@/components/GlobeAIChat"), { ssr: false });
import { 
  Button,
} from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { HeroBackground } from "@/components/HeroBackground";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { CommunityOnboardingModal } from "@/components/CommunityOnboardingModal";
import StripeEscrowPaymentForm from "@/components/StripeEscrowPaymentForm";

const CATEGORIES = [
  { id: "all", name: "All Categories", icon: LayoutGrid },
  { id: "tech", name: "Technology & Programming", icon: Code },
  { id: "engineering", name: "Engineering & Architecture", icon: HardHat },
  { id: "trades", name: "Trades & Local Services", icon: Wrench },
  { id: "design", name: "Design & Creative", icon: Palette },
  { id: "writing", name: "Writing & Translation", icon: Edit3 },
  { id: "marketing", name: "Digital Marketing", icon: Megaphone },
  { id: "video", name: "Video & Photo", icon: Video },
  { id: "business", name: "Business & Support", icon: BarChart3 },
  { id: "legal", name: "Legal & General Consulting", icon: Scale },
];

const OFFER_CATEGORIES = [
  { value: "tech", label: "Technology & Programming" },
  { value: "engineering", label: "Engineering & Architecture" },
  { value: "trades", label: "Trades & Local Services (Plumbing, Electrical, etc.)" },
  { value: "design", label: "Design & Creative" },
  { value: "writing", label: "Writing & Translation" },
  { value: "marketing", label: "Digital Marketing" },
  { value: "video", label: "Video & Photo" },
  { value: "business", label: "Business & Support" },
  { value: "legal", label: "Legal & General Consulting" },
];

const PROJECTS = [
  {
    id: 1,
    title: "Build a Custom AI Agent for Real Estate Analysis",
    description: "Looking for an expert to develop an autonomous agent that can scrape property listings and provide ROI analysis.",
    budget: "$2,000 - $5,000",
    posted: "2 hours ago",
    proposals: 12,
    category: "tech"
  },
  {
    id: 2,
    title: "Video Editor for YouTube Tech Channel",
    description: "Need a creative editor who understands fast-paced tech content. 10-minute videos, 1 per week.",
    budget: "$150 / video",
    posted: "5 hours ago",
    proposals: 8,
    category: "video"
  }
];

const normalizePortfolioItems = (portfolioItems: any) => {
  if (!Array.isArray(portfolioItems)) return [];

  return portfolioItems
    .map((item: any, index: number) => {
      if (typeof item === "string") {
        return {
          id: `portfolio-${index}`,
          title: item,
          description: "",
          imageUrl: null,
          linkUrl: item,
        };
      }

      return {
        id: item?.id || `portfolio-${index}`,
        title: item?.title || item?.name || item?.linkUrl || item?.url || `Portfolio Item ${index + 1}`,
        description: item?.description || "",
        imageUrl: item?.imageUrl || item?.image || null,
        linkUrl: item?.linkUrl || item?.url || null,
      };
    })
    .filter(Boolean);
};

const messageUrlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

const getPresenceMeta = (conversation: any) => {
  const normalizedStatus = typeof conversation?.partnerStatus === "string"
    ? conversation.partnerStatus.toLowerCase()
    : typeof conversation?.status === "string"
      ? conversation.status.toLowerCase()
      : "";

  const isOnline = normalizedStatus === "online" || conversation?.isOnline === true;
  const label = isOnline ? "Online" : "Offline";

  return {
    isOnline,
    label,
    dotClassName: isOnline
      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
      : "bg-white/25",
    textClassName: isOnline ? "text-[#f5c518]" : "text-white/45",
  };
};

const renderLinkedMessageText = (text: string) => {
  const parts = text.split(messageUrlRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (messageUrlRegex.test(part)) {
      const href = part.startsWith("http") ? part : `https://${part}`;

      return (
        <a
          key={`${part}-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 break-all font-medium hover:opacity-80"
        >
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

const triggerAttachmentDownload = (url: string, fileName: string) => {
  if (!url) return;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "attachment";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"offers" | "projects" | "freelancers" | "myOffers" | "myPosts">("offers");
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [userType, setUserType] = useState<"freelancer" | "client" | null>(null);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [freelancers, setFreelancers] = useState<any[]>([]);
  const [selectedFreelancer, setSelectedFreelancer] = useState<any>(null);
  const [freelancerPortfolio, setFreelancerPortfolio] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [loadingMyOffers, setLoadingMyOffers] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [newOffer, setNewOffer] = useState({
    title: "", description: "", category: "", price: "", deliveryDays: "", tags: "",
  });
  const offerImageRef = useRef<HTMLInputElement>(null);
  const [offerImageUrl, setOfferImageUrl] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [loadingMyPosts, setLoadingMyPosts] = useState(false);
  const [showManageProjects, setShowManageProjects] = useState(false);
  const [showManageContracts, setShowManageContracts] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingManagedProjectsContracts, setLoadingManagedProjectsContracts] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    title: "", description: "", category: "", budget: "", deadline: "", skills: "", location: "",
  });
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<{ type: string; label: string; value: string }[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<NodeJS.Timeout | null>(null);

  const [showContractModal, setShowContractModal] = useState(false);
  const [submittingContract, setSubmittingContract] = useState(false);
  const [contractForm, setContractForm] = useState({ title: "", description: "", amount: "", timeline: "", milestones: "" });
  const locationCoordinateCacheRef = useRef<Record<string, { lat: number; lng: number }>>({});

  const [showMessages, setShowMessages] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const activeConversationRef = useRef<any>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hiddenConversationMap, setHiddenConversationMap] = useState<Record<string, string>>({});

  const [selectedDetailsProject, setSelectedDetailsProject] = useState<any>(null);
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [contractActionLoadingId, setContractActionLoadingId] = useState<string | null>(null);
  const [managedProjectContracts, setManagedProjectContracts] = useState<any[]>([]);

  const [isLoadingProfileViewer, setIsLoadingProfileViewer] = useState(false);
  const locationSuggestionMouseDownRef = useRef(false);
  const locationBlurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Escrow & Payment System State ──
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [showFreelancerAcceptModal, setShowFreelancerAcceptModal] = useState(false);
  const [escrowContract, setEscrowContract] = useState<any>(null);
  const [escrowMsg, setEscrowMsg] = useState<any>(null);
  const [escrowProcessing, setEscrowProcessing] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<number | null>(null);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [newPaymentMethodType, setNewPaymentMethodType] = useState("");
  const [newPaymentMethodDetails, setNewPaymentMethodDetails] = useState({ cardNumber: "", expiry: "", cvv: "", name: "", email: "", accountId: "" });
  const [releasingContractId, setReleasingContractId] = useState<string | null>(null);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState<string | null>(null);
  const [chatEscrowMap, setChatEscrowMap] = useState<Record<string, string | null>>({});

  const formatLocalDateTime = useCallback((value: any) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, []);

  const getProjectDateLabel = useCallback((project: any) => {
    if (!project) return null;
    const exactDate = formatLocalDateTime(project.createdAt || project.postedAt || project.updatedAt);
    if (exactDate) return { label: "Posted", value: exactDate };
    if (typeof project.posted === "string" && project.posted.trim()) return { label: "Posted", value: project.posted };
    return null;
  }, [formatLocalDateTime]);

  const getContractDateLabel = useCallback((contract: any) => {
    if (!contract) return null;
    const updated = formatLocalDateTime(contract.statusUpdatedAt);
    if (updated) return { label: "Updated", value: updated };
    const created = formatLocalDateTime(contract.createdAt);
    if (created) return { label: "Created", value: created };
    return null;
  }, [formatLocalDateTime]);

  useEffect(() => {
    if (!hasProfile || !session?.user?.id) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/community/notifications");
        const data = await res.json();
        if (data.notifications) setNotifications(data.notifications);
      } catch (e) {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, [hasProfile, session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.BroadcastChannel) return;

    const channel = new BroadcastChannel("hiremindx-projects");
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "PROJECT_CREATED") {
        fetch("/api/community/projects")
          .then((r) => r.json())
          .then((data) => {
            if (data.projects) {
              setDbProjects(data.projects);
            }
          })
          .catch(console.error);
      }
    };

    channel.addEventListener("message", handleMessage);
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  const globeRef = useRef<GlobeHandle | null>(null);
  const [globeMarkers, setGlobeMarkers] = useState<GlobeMarker[]>([]);
  const [globeWorkers, setGlobeWorkers] = useState<any[]>([]);
  const [selectedGlobeWorker, setSelectedGlobeWorker] = useState<any>(null);
  const [selectedGlobeProject, setSelectedGlobeProject] = useState<any>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showFullProfileModal, setShowFullProfileModal] = useState(false);
  const [profileViewerData, setProfileViewerData] = useState<any>(null);

  const [freelancerLocationFilter, setFreelancerLocationFilter] = useState("");
  const [freelancerCategoryFilter, setFreelancerCategoryFilter] = useState("all");
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);

  const openProfileViewer = useCallback(async (target: any) => {
    const targetUserId = target?.userId || target?.id || target?.partnerId;
    if (!targetUserId) {
      toast.error("Unable to open profile");
      return;
    }

    const fallbackName = target?.displayName || target?.name || target?.partnerName || "Community Member";
    const fallbackHeadline = target?.headline || target?.partnerHeadline || null;
    const fallbackImage = target?.image || target?.userImage || target?.partnerImage || null;
    const fallbackLocation = target?.location || null;
    const fallbackUserType = target?.userType || target?.partnerType || null;
    const fallbackBio = target?.bio || target?.description || target?.companyDescription || null;
    const fallbackPortfolio = normalizePortfolioItems(target?.portfolio || target?.portfolioUrls || []);

    setProfileViewerData({
      id: targetUserId,
      userId: targetUserId,
      name: fallbackName,
      displayName: fallbackName,
      image: fallbackImage,
      headline: fallbackHeadline,
      location: fallbackLocation,
      userType: fallbackUserType,
      bio: fallbackBio,
      description: fallbackBio,
      companyName: target?.companyName || null,
      companyDescription: target?.companyDescription || null,
      workExperience: Array.isArray(target?.workExperience) ? target.workExperience : [],
      skills: Array.isArray(target?.skills) ? target.skills : [],
      portfolio: fallbackPortfolio,
      portfolioUrls: fallbackPortfolio,
      pricingText: target?.pricingText || null,
      hourlyRate: target?.hourlyRate || null,
      availability: target?.availability || null,
    });
    setShowFullProfileModal(true);
    setIsLoadingProfileViewer(true);

    try {
      const response = await fetch(`/api/community/profile?userId=${encodeURIComponent(targetUserId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load profile");
      }

      if (data?.profile) {
        const profile = data.profile;
        const normalizedPortfolio = normalizePortfolioItems(profile.portfolio || profile.portfolioUrls || []);

        setProfileViewerData((prev: any) => ({
          ...prev,
          ...profile,
          id: profile.userId || profile.id || targetUserId,
          userId: profile.userId || profile.id || targetUserId,
          name: profile.name || profile.displayName || prev?.name || fallbackName,
          displayName: profile.displayName || profile.name || prev?.displayName || fallbackName,
          image: profile.image || prev?.image || fallbackImage,
          headline: profile.headline || prev?.headline || fallbackHeadline,
          location: profile.location || prev?.location || fallbackLocation,
          userType: profile.userType || prev?.userType || fallbackUserType,
          bio: profile.bio || profile.description || prev?.bio || fallbackBio,
          description: profile.description || profile.bio || prev?.description || fallbackBio,
          companyName: profile.companyName || prev?.companyName || null,
          companyDescription: profile.companyDescription || prev?.companyDescription || null,
          workExperience: Array.isArray(profile.workExperience) ? profile.workExperience : prev?.workExperience || [],
          skills: Array.isArray(profile.skills) ? profile.skills : prev?.skills || [],
          portfolio: normalizedPortfolio,
          portfolioUrls: normalizedPortfolio,
          pricingText: profile.pricingText || prev?.pricingText || null,
          hourlyRate: profile.hourlyRate || prev?.hourlyRate || null,
          availability: profile.availability || prev?.availability || null,
        }));
      }
    } catch (error) {
      console.error("Error loading profile viewer:", error);
    } finally {
      setIsLoadingProfileViewer(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (locationBlurTimeoutRef.current) {
        clearTimeout(locationBlurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasProfile) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation({ lat, lng });
        const myMarker: GlobeMarker = {
          id: "__my_location__",
          lat,
          lng,
          label: "You",
          type: "user",
          color: "#f5c518",
        };
        setGlobeMarkers((prev) => [...prev.filter((m) => m.id !== "__my_location__"), myMarker]);
        globeRef.current?.flyTo(lat, lng, 2.2);
      },
      () => {}
    );
  }, [hasProfile]);

  useEffect(() => {
    const checkProfile = async () => {
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1");

      if (isLocalhost) {
        setHasProfile(true);
        setIsCheckingProfile(false);
        setUserType("client");
        setActiveTab("offers");
        return;
      }

      if (!session?.user?.id) {
        setHasProfile(true);
        setIsCheckingProfile(false);
        setUserType("client");
        return;
      }

      try {
        const response = await fetch("/api/community/profile");
        const data = await response.json();
        if (data.profile && data.profile.profileComplete) {
          setHasProfile(true);
          setShowOnboarding(false);
          const type = data.profile.userType as "freelancer" | "client";
          setUserType(type);
          setActiveTab(type === "freelancer" ? "projects" : "offers");
        } else {
          setHasProfile(true);
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        setHasProfile(true);
      } finally {
        setIsCheckingProfile(false);
      }
    };

    if (!isPending) {
      checkProfile();
    }
  }, [session, isPending]);

  const handleOnboardingComplete = (type: "freelancer" | "client") => {
    setShowOnboarding(false);
    setHasProfile(true);
    setUserType(type);
    setActiveTab(type === "freelancer" ? "projects" : "offers");
  };

  useEffect(() => {
    if (!hasProfile) return;
    if (userType === "freelancer" && dbProjects.length === 0) {
      fetch("/api/community/projects")
        .then((r) => r.json())
        .then((data) => { if (data.projects) setDbProjects(data.projects); })
        .catch(console.error);
    }
    if (userType === "client" && offers.length === 0) {
      fetch("/api/community/offers")
        .then((r) => r.json())
        .then((data) => { if (data.offers) setOffers(data.offers); })
        .catch(console.error);
    }
  }, [hasProfile, userType]);

  useEffect(() => {
    if (activeTab === "freelancers" && freelancers.length === 0) {
      fetch("/api/community/freelancers")
        .then((r) => r.json())
        .then((data) => {
          if (data.freelancers) setFreelancers(data.freelancers);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "offers" && offers.length === 0) {
      setLoadingOffers(true);
      fetch("/api/community/offers")
        .then((r) => r.json())
        .then((data) => {
          if (data.offers) setOffers(data.offers);
        })
        .catch(console.error)
        .finally(() => setLoadingOffers(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "myOffers" && myOffers.length === 0 && session?.user?.id) {
      setLoadingMyOffers(true);
      fetch(`/api/community/offers?userId=${session.user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.offers) setMyOffers(data.offers);
        })
        .catch(console.error)
        .finally(() => setLoadingMyOffers(false));
    }
  }, [activeTab, session?.user?.id]);

  useEffect(() => {
    if (activeTab === "myPosts" && myPosts.length === 0 && session?.user?.id) {
      setLoadingMyPosts(true);
      fetch(`/api/community/projects?userId=${session.user.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.projects) setMyPosts(data.projects);
        })
        .catch(console.error)
        .finally(() => setLoadingMyPosts(false));
    }
  }, [activeTab, session?.user?.id]);

  useEffect(() => {
    if (activeTab === "projects" && dbProjects.length === 0) {
      fetch("/api/community/projects")
        .then((r) => r.json())
        .then((data) => {
          if (data.projects) setDbProjects(data.projects);
        })
        .catch(console.error);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "projects") return;

    let cancelled = false;

    const refreshProjects = async () => {
      try {
        const res = await fetch("/api/community/projects");
        const data = await res.json();
        if (!cancelled && data.projects) {
          setDbProjects(data.projects);
        }
      } catch (error) {
        console.error("Error refreshing projects:", error);
      }
    };

    refreshProjects();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      if (userType !== "freelancer") {
        setSuggestions([]);
        setShowSuggestions(false);
      }
      return;
    }

    if (userType === "freelancer" && document.activeElement !== null && searchContainerRef.current?.contains(document.activeElement)) {
      return;
    }

    const results: { type: string; label: string; value: string }[] = [];

    CATEGORIES.filter(c => c.id !== "all").forEach((cat) => {
      if (cat.name.toLowerCase().includes(q)) {
        results.push({ type: "Category", label: cat.name, value: cat.name });
      }
    });

    if (userType === "freelancer") {
      [...dbProjects, ...PROJECTS].forEach((p) => {
        if (p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)) {
          if (!results.find((r) => r.label === p.title)) {
            results.push({ type: "Project", label: p.title, value: p.title });
          }
        }
      });
    } else {
      offers.forEach((o: any) => {
        if (o.title?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) {
          if (!results.find((r) => r.label === o.title)) {
            results.push({ type: "Offer", label: o.title, value: o.title });
          }
        }
        if (Array.isArray(o.tags)) {
          o.tags.forEach((tag: string) => {
            if (tag.toLowerCase().includes(q) && !results.find((r) => r.label === tag && r.type === "Tag")) {
              results.push({ type: "Tag", label: tag, value: tag });
            }
          });
        }
      });
    }

    if (userType !== "freelancer") {
      setSuggestions(results.slice(0, 8));
      setShowSuggestions(results.length > 0);
    }
  }, [searchQuery, userType, dbProjects, offers]);

  const handleSelectSuggestion = (suggestion: { type: string; label: string; value: string }) => {
    setSearchQuery(suggestion.value);
    setShowSuggestions(false);
    setTimeout(() => {
      const q = suggestion.value.toLowerCase();
      if (userType === "freelancer") {
        const allProjects = [...dbProjects, ...PROJECTS];
        const filtered = allProjects.filter((p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
        setSearchResults(filtered);
        setActiveTab("projects");
      } else {
        const filtered = offers.filter((o: any) =>
          o.title?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.category?.toLowerCase().includes(q) ||
          (Array.isArray(o.tags) && o.tags.some((t: string) => t.toLowerCase().includes(q)))
        );
        setSearchResults(filtered);
        setActiveTab("offers");
      }
    }, 0);
  };

  const handleSearch = () => {
    setShowSuggestions(false);
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults(null);
      return;
    }

    if (userType === "freelancer") {
      const allProjects = [...dbProjects, ...PROJECTS];
      const filtered = allProjects.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
      setSearchResults(filtered);
      setActiveTab("projects");
    } else {
      if (offers.length === 0) {
        fetch("/api/community/offers")
          .then((r) => r.json())
          .then((data) => {
            if (data.offers) {
              setOffers(data.offers);
              const filtered = data.offers.filter((o: any) =>
                o.title?.toLowerCase().includes(q) ||
                o.description?.toLowerCase().includes(q) ||
                o.category?.toLowerCase().includes(q) ||
                (Array.isArray(o.tags) && o.tags.some((t: string) => t.toLowerCase().includes(q)))
              );
              setSearchResults(filtered);
            }
          });
      } else {
        const filtered = offers.filter((o: any) =>
          o.title?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.category?.toLowerCase().includes(q) ||
          (Array.isArray(o.tags) && o.tags.some((t: string) => t.toLowerCase().includes(q)))
        );
        setSearchResults(filtered);
      }
      setActiveTab("offers");
    }
  };

  const openContractForProject = useCallback((project: any) => {
    if (!project) return;

    setSelectedProject(project);
    setProfileViewerData({
      userId: project.userId,
      id: project.userId,
      name: project.authorName || "Client",
      displayName: project.authorName || "Client",
      image: project.clientImage || null,
      userType: "client",
      location: project.location || null,
    });
    setContractForm({
      title: project.title || "",
      description: project.description || "",
      amount: project.budget?.split("-")[0]?.trim()?.replace(/[^\d.]/g, "") || "",
      timeline: project.deadline || "",
      milestones: "",
    });
    setShowContractModal(true);
  }, []);

  const normalizeMessageForUi = useCallback((message: any) => {
    if (!message) return message;

    let normalizedAttachments = message.attachments;
    if (typeof normalizedAttachments === "string") {
      try {
        normalizedAttachments = JSON.parse(normalizedAttachments);
      } catch {
        normalizedAttachments = null;
      }
    }

    return {
      ...message,
      attachments: Array.isArray(normalizedAttachments) ? normalizedAttachments : [],
    };
  }, []);

  const mergeMessages = useCallback((current: any[], incoming: any[]) => {
    const messageMap = new Map<string, any>();

    current.forEach((message) => {
      const key = message.id ? `id:${message.id}` : `temp:${message.clientTempId || message.createdAt || Math.random()}`;
      messageMap.set(key, message);
    });

    incoming.forEach((message) => {
      const normalized = normalizeMessageForUi(message);
      const serverKey = normalized.id ? `id:${normalized.id}` : null;
      const tempKey = normalized.clientTempId ? `temp:${normalized.clientTempId}` : null;

      if (tempKey && messageMap.has(tempKey) && serverKey) {
        const optimistic = messageMap.get(tempKey);
        messageMap.delete(tempKey);
        messageMap.set(serverKey, {
          ...optimistic,
          ...normalized,
          status: normalized.status || "sent",
          isOptimistic: false,
        });
        return;
      }

      if (serverKey && messageMap.has(serverKey)) {
        messageMap.set(serverKey, {
          ...messageMap.get(serverKey),
          ...normalized,
          isOptimistic: false,
        });
        return;
      }

      if (tempKey && messageMap.has(tempKey)) {
        messageMap.set(tempKey, {
          ...messageMap.get(tempKey),
          ...normalized,
        });
        return;
      }

      messageMap.set(serverKey || tempKey || `fallback:${normalized.createdAt || Math.random()}`, normalized);
    });

    return Array.from(messageMap.values()).sort((a, b) => {
      const first = new Date(a.createdAt || 0).getTime();
      const second = new Date(b.createdAt || 0).getTime();
      return first - second;
    });
  }, [normalizeMessageForUi]);

  const fetchMessagesForConversation = useCallback(async (partnerId: string, options?: { silent?: boolean }) => {
    if (!partnerId) return;
    if (!options?.silent) setLoadingChat(true);

    try {
      const res = await fetch(`/api/community/messages?withUser=${partnerId}`, { credentials: "include" });
      const data = await res.json();

      if (data.messages) {
        const normalized = data.messages.map(normalizeMessageForUi);
        setChatMessages((prev) => mergeMessages(prev, normalized));
      }
    } catch {
    } finally {
      if (!options?.silent) setLoadingChat(false);
    }
  }, [mergeMessages, normalizeMessageForUi]);

  const hiddenConversationStorageKey = useMemo(
    () => session?.user?.id ? `community-hidden-conversations:${session.user.id}` : null,
    [session?.user?.id]
  );

  useEffect(() => {
    if (!hiddenConversationStorageKey || typeof window === "undefined") {
      setHiddenConversationMap({});
      return;
    }

    try {
      const stored = window.localStorage.getItem(hiddenConversationStorageKey);
      setHiddenConversationMap(stored ? JSON.parse(stored) : {});
    } catch {
      setHiddenConversationMap({});
    }
  }, [hiddenConversationStorageKey]);

  const persistHiddenConversationMap = useCallback((nextMap: Record<string, string>) => {
    setHiddenConversationMap(nextMap);
    if (!hiddenConversationStorageKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(hiddenConversationStorageKey, JSON.stringify(nextMap));
    } catch {}
  }, [hiddenConversationStorageKey]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/community/messages?conversations=true", { credentials: "include" });
      const data = await res.json();
      if (data.conversations) {
        let nextHiddenMap = hiddenConversationMap;
        const visibleConversations = data.conversations.filter((conv: any) => {
          const hiddenAt = hiddenConversationMap[conv.partnerId];
          if (!hiddenAt) return true;

          const hiddenTime = new Date(hiddenAt).getTime();
          const lastMessageTime = new Date(conv.lastMessageAt || 0).getTime();

          if (lastMessageTime > hiddenTime) {
            const { [conv.partnerId]: _removed, ...rest } = nextHiddenMap;
            nextHiddenMap = rest;
            return true;
          }

          return false;
        });

        if (nextHiddenMap !== hiddenConversationMap) {
          persistHiddenConversationMap(nextHiddenMap);
        }

        setConversations(visibleConversations);
        setUnreadCount(visibleConversations.reduce((sum: number, c: any) => sum + c.unreadCount, 0));
      }
    } catch {} finally { setLoadingConversations(false); }
  };

  const openConversation = async (conv: any) => {
    setActiveConversation(conv);
    activeConversationRef.current = conv;
    setShowPlusMenu(false);
    await fetchMessagesForConversation(conv.partnerId);
    try {
      await fetch("/api/community/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withUser: conv.partnerId }) });
      setConversations((prev) => prev.map((c) => c.partnerId === conv.partnerId ? { ...c, unreadCount: 0 } : c));
      setUnreadCount((prev) => Math.max(0, prev - (conv.unreadCount || 0)));
    } catch {}
  };

  const deleteConversation = async (conv: any) => {
    const confirmed = window.confirm("Hide this conversation from your messages? It will reappear automatically when a new message arrives.");
    if (!confirmed) return;

    try {
      const nextHiddenMap = {
        ...hiddenConversationMap,
        [conv.partnerId]: new Date().toISOString(),
      };
      persistHiddenConversationMap(nextHiddenMap);

      setConversations((prev) => prev.filter((c) => c.partnerId !== conv.partnerId));
      if (activeConversation?.partnerId === conv.partnerId) {
        setActiveConversation(null);
        setChatMessages([]);
      }
      setUnreadCount((prev) => Math.max(0, prev - (conv.unreadCount || 0)));
      toast.success("Conversation hidden");
    } catch (error: any) {
      toast.error(error?.message || "Failed to hide conversation");
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !activeConversation || !session?.user?.id) {
      if (!session?.user?.id) toast.error("Please log in to send messages");
      return;
    }

    const messageContent = newMessage.trim();
    const attachmentToSend = attachment;
    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();

    setSendingMessage(true);
    setNewMessage("");
    setAttachment(null);
    setShowPlusMenu(false);

    try {
      let attachmentsToSave = null;
      let optimisticAttachments: any[] = [];

      if (attachmentToSend) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = () => reject(new Error("File read failed"));
          reader.readAsDataURL(attachmentToSend);
        });

        optimisticAttachments = [{
          name: attachmentToSend.name,
          type: attachmentToSend.type,
          size: attachmentToSend.size,
          url: base64,
        }];

        attachmentsToSave = optimisticAttachments;
      }

      const optimisticMessage = normalizeMessageForUi({
        clientTempId,
        senderId: session.user.id,
        receiverId: activeConversation.partnerId,
        message: messageContent || "",
        attachments: optimisticAttachments,
        createdAt: nowIso,
        status: "sending",
        isOptimistic: true,
      });

      setChatMessages((prev) => mergeMessages(prev, [optimisticMessage]));

      const previewText = attachmentToSend ? (messageContent || "Attachment") : formatConversationPreview(messageContent);
      setConversations((prev) => {
        const exists = prev.find((c) => c.partnerId === activeConversation.partnerId);
        if (exists) {
          return prev.map((c) => c.partnerId === activeConversation.partnerId ? { ...c, lastMessage: previewText, lastMessageAt: nowIso } : c);
        }
        return [{ ...activeConversation, lastMessage: previewText, lastMessageAt: nowIso }, ...prev];
      });

      const res = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          receiverId: activeConversation.partnerId, 
          message: messageContent || "Sent an attachment",
          attachments: attachmentsToSave,
          clientTempId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 429 && data?.limitReached) {
          const usage = data.usage || {};
          window.dispatchEvent(new CustomEvent("usage-limit-reached", { detail: { message: data.error, resetAt: usage.resetAt || null, isLifetime: usage.isLifetime !== undefined ? usage.isLifetime : true } }));
          throw new Error("LIMIT_REACHED_SILENT");
        }
        throw new Error(data?.error || "Send failed");
      }

      if (data?.message) {
        const sentMessage = normalizeMessageForUi({
          ...data.message,
          clientTempId,
          status: data.message.status || "sent",
          isOptimistic: false,
        });
        setChatMessages((prev) => mergeMessages(prev, [sentMessage]));
      }

      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
      fetchConversations();
    } catch (err: any) {
      console.error("Community sendMessage failed", err);
      const isSilent = err instanceof Error && err.message === "LIMIT_REACHED_SILENT";
      
      if (!isSilent) {
        setChatMessages((prev) => prev.map((msg) => msg.clientTempId === clientTempId ? { ...msg, status: "failed", isOptimistic: false } : msg));
        toast.error(err.message || "Failed to send message");
      } else {
        // Just remove the optimistic message if they hit the limit
        setChatMessages((prev) => prev.filter((msg) => msg.clientTempId !== clientTempId));
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const startChatWithFreelancer = (freelancer: any) => {
    const partnerId = freelancer.userId || freelancer.id;
    if (!partnerId) {
      toast.error("Could not find freelancer ID");
      return;
    }
    
    setShowMessages(true);
    const conv = {
      partnerId,
      partnerName: freelancer.displayName || freelancer.name || "Freelancer",
      partnerImage: freelancer.image || freelancer.userImage || null,
      partnerType: freelancer.userType || "freelancer",
      partnerHeadline: freelancer.headline || null,
      lastMessage: "",
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };
    
    setConversations((prev) => {
      const existing = prev.find((c) => c.partnerId === partnerId);
      if (!existing) return [conv, ...prev];
      return prev;
    });
    openConversation(conv);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    if (showMessages && activeConversation?.partnerId) {
      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
      chatPollRef.current = setInterval(async () => {
        const currentConversation = activeConversationRef.current;
        if (!currentConversation?.partnerId) return;
        await fetchMessagesForConversation(currentConversation.partnerId, { silent: true });
        fetchConversations();
        fetchManagedContracts();
      }, 2000);
      return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [showMessages, activeConversation, fetchMessagesForConversation]);

  useEffect(() => {
    if (showMessages) fetchConversations();
  }, [showMessages]);

  useEffect(() => {
    if (!hasProfile || !session?.user?.id) return;
    const checkUnread = async () => {
      try {
        const res = await fetch("/api/community/messages?conversations=true");
        const data = await res.json();
        if (data.conversations) {
          setUnreadCount(data.conversations.reduce((sum: number, c: any) => sum + c.unreadCount, 0));
        }
      } catch {}
    };
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
  }, [hasProfile, session?.user?.id]);

  const handleOfferImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setOfferImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreateOffer = async () => {
    if (!newOffer.title || !newOffer.category || !newOffer.price || !newOffer.deliveryDays) return;
    setCreatingOffer(true);
    try {
      const res = await fetch("/api/community/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newOffer.title,
          description: newOffer.description,
          category: newOffer.category,
          price: parseInt(newOffer.price),
          deliveryDays: parseInt(newOffer.deliveryDays),
          imageUrl: offerImageUrl || null,
          tags: newOffer.tags ? newOffer.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        }),
      });
      if (res.ok) {
        await res.json();
        const refreshRes = await fetch("/api/community/offers");
        const refreshData = await refreshRes.json();
        if (refreshData.offers) setOffers(refreshData.offers);
        if (session?.user?.id) {
          const myRes = await fetch(`/api/community/offers?userId=${session.user.id}`);
          const myData = await myRes.json();
          if (myData.offers) setMyOffers(myData.offers);
        }
        setShowCreateOffer(false);
        setNewOffer({ title: "", description: "", category: "", price: "", deliveryDays: "", tags: "" });
        setOfferImageUrl("");
        toast.success("Offer created successfully!");
      } else {
        toast.error("Failed to create offer");
      }
    } catch {
      toast.error("Failed to create offer");
    } finally {
      setCreatingOffer(false);
    }
  };

  const handleSendContract = async () => {
    if (!profileViewerData || !contractForm.title || !contractForm.description || !contractForm.amount) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmittingContract(true);
    try {
      const partnerId = profileViewerData.userId || profileViewerData.id;
      const contractId = `contract_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const contractPayload = {
        type: "contract_offer",
        version: 1,
        contractId,
        title: contractForm.title.trim(),
        amount: Number(contractForm.amount),
        timeline: contractForm.timeline.trim(),
        milestones: contractForm.milestones.trim(),
        description: contractForm.description.trim(),
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: partnerId,
          message: `[CONTRACT_OFFER_JSON]${JSON.stringify(contractPayload)}`,
        }),
      });
      const data = await res.json().catch(() => null);
      
      if (res.ok || (res.status === 400 && data?.error?.includes("demo profile"))) {
        toast.success("Contract offer sent!");
        
        try {
          await fetch("/api/community/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: partnerId,
              type: "contract_offer",
              title: "New Contract Offer Received",
              message: `You have received a new contract offer: ${contractForm.title} for $${contractForm.amount}. Check your messages!`,
            })
          });
        } catch (err) {
          console.error("Failed to post notification:", err);
        }

        setShowContractModal(false);
        setContractForm({ title: "", description: "", amount: "", timeline: "", milestones: "" });
        startChatWithFreelancer(profileViewerData);
        setConversations((prev) => prev.map((conv) =>
          conv.partnerId === partnerId
            ? {
                ...conv,
                lastMessage: formatConversationPreview(`[CONTRACT_OFFER_JSON]${JSON.stringify(contractPayload)}`),
                lastMessageAt: new Date().toISOString(),
              }
            : conv
        ));
      } else {
        toast.error(data?.error || data?.details || "Failed to send contract");
      }
    } catch {
      toast.error("Error sending contract");
    } finally {
      setSubmittingContract(false);
    }
  };

  const formatConversationPreview = useCallback((rawMessage: string) => {
    if (typeof rawMessage !== "string") return "No messages yet";

    if (rawMessage.startsWith("[CONTRACT_OFFER_JSON]")) {
      try {
        const parsed = JSON.parse(rawMessage.replace("[CONTRACT_OFFER_JSON]", ""));
        if (parsed?.type === "contract_offer") {
          const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Contract Offer";
          return `📄 Contract Offer: ${title}`;
        }
      } catch {}
      return "📄 Contract Offer";
    }

    if (rawMessage.startsWith("[CONTRACT_RESPONSE]")) {
      try {
        const parsed = JSON.parse(rawMessage.replace("[CONTRACT_RESPONSE]", ""));
        if (parsed?.action === "accepted") return "✅ Contract accepted";
        if (parsed?.action === "declined") return "❌ Contract declined";
      } catch {}
      return "📄 Contract updated";
    }

    if (rawMessage.startsWith("[CONTRACT_CANCEL]")) {
      return "⚠️ Contract cancelled";
    }

    return rawMessage || "No messages yet";
  }, []);

  const parseContractOfferMessage = useCallback((rawMessage: string) => {
    if (typeof rawMessage !== "string") return null;

    if (rawMessage.startsWith("[CONTRACT_OFFER_JSON]")) {
      try {
        const parsed = JSON.parse(rawMessage.replace("[CONTRACT_OFFER_JSON]", ""));
        if (parsed?.type === "contract_offer" && parsed?.contractId) {
          return {
            contractId: String(parsed.contractId),
            title: String(parsed.title || "Contract Offer"),
            amount: parsed.amount != null ? String(parsed.amount) : "",
            timeline: String(parsed.timeline || ""),
            milestones: String(parsed.milestones || ""),
            description: String(parsed.description || ""),
            createdAt: String(parsed.createdAt || ""),
          };
        }
      } catch {}
    }

    if (!rawMessage.startsWith("[CONTRACT OFFER]")) return null;

    const lines = rawMessage.split("\n");
    const title = lines.find((line) => line.startsWith("Title: "))?.replace("Title: ", "") || "Contract Offer";
    const amount = lines.find((line) => line.startsWith("Amount: "))?.replace("Amount: ", "").replace("$", "") || "";
    const timeline = lines.find((line) => line.startsWith("Timeline: "))?.replace("Timeline: ", "") || "";
    const milestones = lines.find((line) => line.startsWith("Milestones: "))?.replace("Milestones: ", "") || "";
    const descriptionIndex = lines.findIndex((line) => line.trim() === "Description:");
    const description = descriptionIndex >= 0 ? lines.slice(descriptionIndex + 1).join("\n").trim() : "";
    const fallbackKey = rawMessage.replace(/\s+/g, " ").trim().slice(0, 120);

    return {
      contractId: `legacy_${fallbackKey}`,
      title,
      amount,
      timeline,
      milestones,
      description,
      createdAt: "",
    };
  }, []);

  const parseContractEventMessage = useCallback((rawMessage: string) => {
    if (typeof rawMessage !== "string") return null;

    const prefixes = ["[CONTRACT_RESPONSE]", "[CONTRACT_CANCEL]"];
    const matchedPrefix = prefixes.find((prefix) => rawMessage.startsWith(prefix));
    if (!matchedPrefix) return null;

    try {
      const parsed = JSON.parse(rawMessage.replace(matchedPrefix, ""));
      if (!parsed?.contractId) return null;
      return {
        contractId: String(parsed.contractId),
        action: parsed.action === "accepted" ? "accepted" : parsed.action === "declined" ? "declined" : "cancelled",
        actedAt: String(parsed.actedAt || ""),
        actorName: String(parsed.actorName || ""),
      };
    } catch {
      return null;
    }
  }, []);

  const fetchManagedContracts = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch("/api/community/contracts", { credentials: "include" });
      const data = await res.json();
      if (data.contracts) {
        setContracts(data.contracts);
        const escrowMap: Record<string, string | null> = {};
        for (const c of data.contracts) {
          escrowMap[c.contractId] = c.escrowStatus || null;
        }
        setChatEscrowMap(escrowMap);
        setManagedProjectContracts(data.contracts.filter((contract: any) => contract.isOngoing));
      }
    } catch {}
  }, [session?.user?.id]);

  const handleContractAction = useCallback(async (msg: any, action: "accepted" | "declined" | "cancelled") => {
    if (!activeConversation || !session?.user?.id) return;

    const contractOffer = parseContractOfferMessage(msg.message);
    if (!contractOffer) return;

    const isSender = msg.senderId === session.user.id;
    if ((action === "accepted" || action === "declined") && isSender) {
      toast.error("Only the receiver can accept or decline this contract");
      return;
    }
    if (action === "cancelled" && !isSender) {
      toast.error("Only the sender can cancel this contract");
      return;
    }

    // Intercept "accepted" to show escrow modal
    if (action === "accepted") {
      setEscrowContract(contractOffer);
      setEscrowMsg(msg);
      
      // Determine who sent the contract — if freelancer sent it, client is accepting (show payment modal)
      // If client sent it, freelancer is accepting (show info modal)
      const senderIsFreelancer = activeConversation?.partnerType === "freelancer" ? false : true; // I'm the receiver
      
      if (userType === "client") {
        // Client is accepting — show payment modal with escrow
        setShowEscrowModal(true);
        // Load saved Stripe payment methods
        try {
          const res = await fetch("/api/community/payment-methods/stripe");
          const data = await res.json();
          if (data.paymentMethods) {
            setSavedPaymentMethods(data.paymentMethods);
            if (data.paymentMethods.length > 0) {
              setSelectedPaymentMethod(data.paymentMethods[0].id);
            }
          }
        } catch {}
      } else {
        // Freelancer is accepting — show info modal
        setShowFreelancerAcceptModal(true);
      }
      return;
    }

    setContractActionLoadingId(contractOffer.contractId);

    try {
      const responsePayload = {
        type: action === "cancelled" ? "contract_cancel" : "contract_response",
        contractId: contractOffer.contractId,
        action,
        actedAt: new Date().toISOString(),
        actorName: session.user.name || "User",
      };

      const prefix = action === "cancelled" ? "[CONTRACT_CANCEL]" : "[CONTRACT_RESPONSE]";
      const res = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activeConversation.partnerId,
          message: `${prefix}${JSON.stringify(responsePayload)}`,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.details || "Failed to update contract");
      }

      if (data?.message) {
        setChatMessages((prev) => mergeMessages(prev, [normalizeMessageForUi(data.message)]));
      }

      toast.success(action === "declined" ? "Contract declined" : "Contract cancelled");
      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
      fetchConversations();
      fetchManagedContracts();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update contract");
    } finally {
      setContractActionLoadingId(null);
    }
  }, [activeConversation, fetchConversations, fetchManagedContracts, fetchMessagesForConversation, mergeMessages, normalizeMessageForUi, parseContractOfferMessage, session?.user?.id, session?.user?.name, userType]);

  // Process escrow payment (client paying to accept contract)
  const handleEscrowPayment = useCallback(async () => {
    if (!escrowContract || !activeConversation || !session?.user?.id) return;
    if (!selectedPaymentMethod && savedPaymentMethods.length > 0) {
      toast.error("Please select a payment method");
      return;
    }

    setEscrowProcessing(true);
    try {
      // 1. Fund the escrow FIRST — contract is not truly accepted until money is in escrow
      const escrowRes = await fetch("/api/community/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fund",
          contractId: escrowContract.contractId,
          freelancerId: activeConversation.partnerId,
          contractAmount: Number(escrowContract.amount),
          paymentMethodId: selectedPaymentMethod,
        }),
      });

      if (!escrowRes.ok) throw new Error("Failed to fund escrow");

      // 2. Only after successful escrow funding, mark contract as accepted
      const responsePayload = {
        type: "contract_response",
        contractId: escrowContract.contractId,
        action: "accepted",
        actedAt: new Date().toISOString(),
        actorName: session.user.name || "User",
      };

      const msgRes = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activeConversation.partnerId,
          message: `[CONTRACT_RESPONSE]${JSON.stringify(responsePayload)}`,
        }),
      });

      if (!msgRes.ok) throw new Error("Failed to accept contract");

      const msgData = await msgRes.json().catch(() => null);
      if (msgData?.message) {
        setChatMessages((prev) => mergeMessages(prev, [normalizeMessageForUi(msgData.message)]));
      }

      toast.success("Contract accepted & payment escrowed successfully!");
      setShowEscrowModal(false);
      setEscrowContract(null);
      setEscrowMsg(null);
      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
      fetchConversations();
      fetchManagedContracts();
    } catch (error: any) {
      toast.error(error?.message || "Failed to process payment");
    } finally {
      setEscrowProcessing(false);
    }
  }, [escrowContract, activeConversation, session?.user?.id, session?.user?.name, selectedPaymentMethod, savedPaymentMethods, fetchConversations, fetchManagedContracts, fetchMessagesForConversation, mergeMessages, normalizeMessageForUi]);

  // Freelancer accepts contract (no payment, just acceptance + notify client)
  const handleFreelancerAcceptContract = useCallback(async () => {
    if (!escrowContract || !activeConversation || !session?.user?.id) return;

    setEscrowProcessing(true);
    try {
      const responsePayload = {
        type: "contract_response",
        contractId: escrowContract.contractId,
        action: "accepted",
        actedAt: new Date().toISOString(),
        actorName: session.user.name || "User",
      };

      const res = await fetch("/api/community/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activeConversation.partnerId,
          message: `[CONTRACT_RESPONSE]${JSON.stringify(responsePayload)}`,
        }),
      });

      if (!res.ok) throw new Error("Failed to accept contract");

      const data = await res.json().catch(() => null);
      if (data?.message) {
        setChatMessages((prev) => mergeMessages(prev, [normalizeMessageForUi(data.message)]));
      }

      // Notify client to proceed with payment
      await fetch("/api/community/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: activeConversation.partnerId,
          type: "contract_accepted_pending_payment",
          title: "Freelancer Accepted Your Contract!",
          message: `${session.user.name || "The freelancer"} accepted your contract "${escrowContract.title}". Please proceed to pay £${escrowContract.amount} + 10% platform fee (total £${(Number(escrowContract.amount) * 1.1).toFixed(2)}) to fund the escrow.`,
        }),
      }).catch(() => {});

      toast.success("Contract accepted! The client will be notified to fund the escrow.");
      setShowFreelancerAcceptModal(false);
      setEscrowContract(null);
      setEscrowMsg(null);
      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
      fetchConversations();
      fetchManagedContracts();
    } catch (error: any) {
      toast.error(error?.message || "Failed to accept contract");
    } finally {
      setEscrowProcessing(false);
    }
  }, [escrowContract, activeConversation, session?.user?.id, session?.user?.name, fetchConversations, fetchManagedContracts, fetchMessagesForConversation, mergeMessages, normalizeMessageForUi]);

  // Add a new payment method
  const handleAddPaymentMethod = useCallback(async () => {
    if (!newPaymentMethodType) {
      toast.error("Please select a payment method type");
      return;
    }

    const isCard = newPaymentMethodType === "debit_card" || newPaymentMethodType === "credit_card";
    if (isCard && (!newPaymentMethodDetails.cardNumber || !newPaymentMethodDetails.expiry || !newPaymentMethodDetails.cvv)) {
      toast.error("Please fill in all card details");
      return;
    }

    const isEmailBased = newPaymentMethodType === "paypal" || newPaymentMethodType === "wise";
    if (isEmailBased && !newPaymentMethodDetails.email) {
      toast.error("Please enter the email address");
      return;
    }

    try {
      const last4 = isCard ? newPaymentMethodDetails.cardNumber.slice(-4) : undefined;
      const [expiryMonth, expiryYear] = isCard ? newPaymentMethodDetails.expiry.split("/").map(Number) : [undefined, undefined];
      const typeLabels: Record<string, string> = {
        debit_card: "Debit Card",
        credit_card: "Credit Card",
        paypal: "PayPal",
        wise: "Wise",
        payoneer: "Payoneer",
        bank_swift: "Bank (SWIFT)",
      };

      const label = isCard
        ? `${typeLabels[newPaymentMethodType]} ending ${last4}`
        : isEmailBased
          ? `${typeLabels[newPaymentMethodType]} - ${newPaymentMethodDetails.email}`
          : `${typeLabels[newPaymentMethodType]} - ${newPaymentMethodDetails.accountId || "Account"}`;

      const res = await fetch("/api/community/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newPaymentMethodType,
          label,
          last4,
          cardBrand: isCard ? "visa" : undefined,
          expiryMonth,
          expiryYear: expiryYear ? (expiryYear < 100 ? 2000 + expiryYear : expiryYear) : undefined,
          email: isEmailBased ? newPaymentMethodDetails.email : undefined,
          accountId: newPaymentMethodDetails.accountId || undefined,
          isDefault: savedPaymentMethods.length === 0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.paymentMethod) {
        setSavedPaymentMethods((prev) => [...prev, data.paymentMethod]);
        setSelectedPaymentMethod(data.paymentMethod.id);
        setShowAddPaymentMethod(false);
        setNewPaymentMethodType("");
        setNewPaymentMethodDetails({ cardNumber: "", expiry: "", cvv: "", name: "", email: "", accountId: "" });
        toast.success("Payment method added!");
      } else {
        toast.error(data?.error || "Failed to add payment method");
      }
    } catch {
      toast.error("Failed to add payment method");
    }
  }, [newPaymentMethodType, newPaymentMethodDetails, savedPaymentMethods]);

  // Release money from escrow (client action)
  const handleReleaseMoney = useCallback(async (contractId: string) => {
    setReleasingContractId(contractId);
    try {
      const res = await fetch("/api/community/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release", contractId }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Money released to freelancer!");
        setShowReleaseConfirm(null);
        fetchManagedContracts();
      } else {
        toast.error(data?.error || "Failed to release funds");
      }
    } catch {
      toast.error("Failed to release funds");
    } finally {
      setReleasingContractId(null);
    }
  }, [fetchManagedContracts]);

  const handleCreateProject = async () => {
    if (!newProject.title || !newProject.category || !newProject.budget) return;
    setCreatingProject(true);
    try {
      const res = await fetch("/api/community/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newProject.title,
          description: newProject.description,
          category: newProject.category,
          budget: newProject.budget,
          deadline: newProject.deadline || null,
          skills: newProject.skills ? newProject.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
          location: newProject.location.trim() || null,
        }),
      });
      if (res.ok) {
        if (session?.user?.id) {
          const myRes = await fetch(`/api/community/projects?userId=${session.user.id}`);
          const myData = await myRes.json();
          if (myData.projects) setMyPosts(myData.projects);
        }
        const allRes = await fetch("/api/community/projects");
        const allData = await allRes.json();
        if (allData.projects) setDbProjects(allData.projects);
        setShowCreateProject(false);
        setNewProject({ title: "", description: "", category: "", budget: "", deadline: "", skills: "", location: "" });
        toast.success("Project posted successfully!");
      } else {
        toast.error("Failed to post project");
      }
    } catch {
      toast.error("Failed to post project");
    } finally {
      setCreatingProject(false);
    }
  };

  const openFreelancerPortfolio = async (freelancer: any) => {
    const normalizedFreelancer = {
      ...freelancer,
      portfolio: normalizePortfolioItems(freelancer?.portfolio || freelancer?.portfolioUrls || []),
    };

    setSelectedFreelancer(normalizedFreelancer);
    setFreelancerPortfolio(normalizedFreelancer.portfolio);

    try {
      const userId = freelancer?.userId || freelancer?.id;
      if (!userId) return;

      const res = await fetch(`/api/community/portfolio?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      const normalizedItems = normalizePortfolioItems(data.items || freelancer?.portfolio || freelancer?.portfolioUrls || []);
      setSelectedFreelancer((prev: any) => prev ? { ...prev, portfolio: normalizedItems } : prev);
      setFreelancerPortfolio(normalizedItems);
    } catch {
      setFreelancerPortfolio(normalizedFreelancer.portfolio);
    }
  };

  const filteredProjects = useMemo(() => {
    return dbProjects.filter((p) => {
      if (freelancerCategoryFilter !== "all" && p.category !== freelancerCategoryFilter) return false;
      if (freelancerLocationFilter) {
        const search = freelancerLocationFilter.toLowerCase().trim();
        const queryParts = search.split(/[\s,]+/).filter(Boolean);
        const searchableFields = [
          p.projectLocation,
          p.location,
          p.city,
          p.region,
          p.country,
          p.title,
          p.description,
        ]
          .filter(Boolean)
          .join(" | ")
          .toLowerCase();

        const normalizedLocation = (p.location || "").toLowerCase().trim();
        const exactMatch = normalizedLocation === search;
        const partialMatch = searchableFields.includes(search);
        const tokenMatch = queryParts.every((part) => searchableFields.includes(part));

        if (!exactMatch && !partialMatch && !tokenMatch) return false;
      }
      return true;
    });
  }, [dbProjects, freelancerCategoryFilter, freelancerLocationFilter]);

  useEffect(() => {
    if (userType !== "freelancer" || !userLocation) return;

    let cancelled = false;

    const resolveProjectCoordinates = async () => {
      const baseMarkers: GlobeMarker[] = [{
        id: "__my_location__",
        lat: userLocation.lat,
        lng: userLocation.lng,
        label: "You",
        type: "user",
        color: "#f5c518",
      }];

      const projectsNeedingLookup = filteredProjects.slice(0, 25);
      const resolvedProjectMarkers: GlobeMarker[] = projectsNeedingLookup.flatMap((project) => {
        const explicitLat = Number(project.lat);
        const explicitLng = Number(project.lng);

        if (!Number.isFinite(explicitLat) || !Number.isFinite(explicitLng)) {
          return [];
        }

        return [{
          id: `proj_${project.id}`,
          lat: explicitLat,
          lng: explicitLng,
          label: project.title,
          type: "project" as const,
          color: "#22c55e",
        }];
      });

      const uncachedProjects = projectsNeedingLookup.filter((project) => {
        const explicitLat = Number(project.lat);
        const explicitLng = Number(project.lng);
        if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) return false;

        const resolvedProjectLocation = String(project.projectLocation || project.location || "").trim().toLowerCase();
        return Boolean(resolvedProjectLocation && !locationCoordinateCacheRef.current[resolvedProjectLocation]);
      });

      if (!cancelled) {
        const cachedMarkers = projectsNeedingLookup.flatMap((project) => {
          const locationKey = String(project.projectLocation || project.location || "").trim().toLowerCase();
          const cached = locationCoordinateCacheRef.current[locationKey];
          if (!cached) return [];

          return [{
            id: `proj_${project.id}`,
            lat: cached.lat,
            lng: cached.lng,
            label: project.title,
            type: "project" as const,
            color: "#22c55e",
          }];
        });

        setGlobeMarkers([...baseMarkers, ...resolvedProjectMarkers, ...cachedMarkers]);
      }

      const newlyResolved = await Promise.all(
        uncachedProjects.map(async (project) => {
          const resolvedProjectLocation = project.projectLocation || project.location;
          const locationKey = String(resolvedProjectLocation || "").trim().toLowerCase();
          if (!locationKey) return null;

          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(resolvedProjectLocation)}&limit=1`, {
              headers: { "Accept-Language": "en" },
            });
            const results = await response.json();
            const first = Array.isArray(results) ? results[0] : null;
            if (!first?.lat || !first?.lon) return null;

            const coords = { lat: Number(first.lat), lng: Number(first.lon) };
            if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;

            locationCoordinateCacheRef.current[locationKey] = coords;
            return {
              id: `proj_${project.id}`,
              lat: coords.lat,
              lng: coords.lng,
              label: project.title,
              type: "project" as const,
              color: "#22c55e",
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setGlobeMarkers((prev) => {
        const userMarker = prev.find((marker) => marker.id === "__my_location__") || baseMarkers[0];
        const combinedProjectMarkers = [...resolvedProjectMarkers, ...newlyResolved.filter(Boolean)] as GlobeMarker[];
        return [userMarker, ...combinedProjectMarkers];
      });
    };

    resolveProjectCoordinates();
    return () => {
      cancelled = true;
    };
  }, [userType, userLocation, filteredProjects]);

  useEffect(() => {
    if (userType !== "freelancer") return;

    const q = freelancerLocationFilter.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearchingLocations(false);
      return;
    }

    const normalizedQuery = q.toLowerCase();
    const queryParts = normalizedQuery.split(/[\s,]+/).filter(Boolean);
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearchingLocations(true);

      try {
        const queryVariants = Array.from(new Set([
          freelancerLocationFilter,
          freelancerLocationFilter.replace(/\s+/g, " ").trim(),
          ...queryParts,
        ])).filter((value) => value.length >= 2);

        const responses = await Promise.all(
          queryVariants.slice(0, 3).map(async (variant) => {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(variant)}&limit=10&addressdetails=1&dedupe=1`,
              {
                headers: {
                  "Accept-Language": "en",
                },
                signal: controller.signal,
              }
            );
            return res.json();
          })
        );

        const dedupedResults = new Map<string, { type: string; label: string; value: string } & { score: number }>();

        responses.forEach((batch) => {
          if (!Array.isArray(batch)) return;

          batch.forEach((item: any) => {
            const displayName = typeof item?.display_name === "string" ? item.display_name : "";
            if (!displayName) return;

            const lowerDisplayName = displayName.toLowerCase();
            const address = item?.address || {};
            const labelParts = [
              address.city,
              address.town,
              address.village,
              address.county,
              address.state,
              address.country,
            ].filter(Boolean);
            const compactLabel = labelParts.length > 0 ? Array.from(new Set(labelParts)).join(", ") : displayName;

            const score = queryParts.reduce((total: number, part: string) => {
              if (lowerDisplayName.startsWith(part)) return total + 4;
              if (lowerDisplayName.includes(` ${part}`)) return total + 3;
              if (lowerDisplayName.includes(part)) return total + 2;
              return total;
            }, 0) + (item?.importance || 0);

            const key = `${item?.lat}-${item?.lon}-${compactLabel}`;
            const nextValue = {
              type: "location",
              label: compactLabel,
              value: compactLabel,
              score,
            };

            const existing = dedupedResults.get(key);
            if (!existing || existing.score < score) {
              dedupedResults.set(key, nextValue);
            }
          });
        });

        const locationResults = Array.from(dedupedResults.values())
          .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
          .slice(0, 12)
          .map(({ score, ...item }) => item);

        setSuggestions(locationResults);
        setShowSuggestions(locationResults.length > 0);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        setIsSearchingLocations(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [freelancerLocationFilter, userType]);

  if (isPending || isCheckingProfile) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <HeroBackground />
        <div className="text-center relative z-10">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/40 tracking-wide">Loading community...</p>
        </div>
      </div>
    );
  }

  const inp = "bg-white/[0.05] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20 focus:ring-white/10 rounded-xl h-12";
  const textarea = "w-full px-4 py-3 rounded-xl resize-none text-sm bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 transition-all";
  const selectCls = `w-full h-12 px-4 rounded-xl text-sm border bg-white/[0.05] border-white/[0.08] text-white focus:outline-none focus:ring-2 focus:ring-white/10`;
  const modalCard = "relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] bg-[#0a0a0a] border border-white/[0.08]";
  const modalHeader = "sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl";
  const modalFooter = "sticky bottom-0 p-6 pt-4 border-t border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl";

  return (
    <div className="relative min-h-screen text-white font-sans">
      <HeroBackground />
      {session?.user?.id && (
        <CommunityOnboardingModal
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
          userId={session.user.id}
        />
      )}

      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
        >
          <Layers3 className="w-4 h-4 text-white/70" />
          <span className="text-xs font-bold tracking-[0.25em] uppercase text-white/80">HireMindX</span>
        </button>
      </div>

      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        <button onClick={() => router.push("/profile")} className="pointer-events-auto w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          {session?.user?.image ? (
            <Avatar className="w-7 h-7"><AvatarImage src={session.user.image} /><AvatarFallback className="text-xs bg-white/10">{session.user.name?.[0] || "U"}</AvatarFallback></Avatar>
          ) : (<User className="w-4 h-4 text-white/60" />)}
        </button>
        <button onClick={() => setShowMessages(true)} className="relative w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white/60" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>

        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="relative w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
            <Bell className="w-4 h-4 text-white/60" />
            {notifications.filter((n) => !n.isRead).length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#f5c518] text-black text-[9px] font-bold rounded-full flex items-center justify-center">{notifications.filter((n) => !n.isRead).length}</span>}
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-14 w-80 max-h-96 overflow-y-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl z-50 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-sm text-white">Notifications</h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/community/notifications", { method: "DELETE" });
                          if (!res.ok) throw new Error("Failed to clear notifications");
                          setNotifications([]);
                          toast.success("All notifications cleared");
                        } catch {
                          toast.error("Failed to clear notifications");
                        }
                      }}
                      className="text-[11px] font-medium text-white/50 hover:text-white transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">No new notifications</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notif: any) => (
                      <div key={notif.id} className={`p-3 rounded-xl text-left border ${notif.isRead ? "bg-white/5 border-transparent" : "bg-white/10 border-white/20"}`} onClick={async () => {
                        if (!notif.isRead) {
                          await fetch("/api/community/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: notif.id }) });
                          setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, isRead: true } : n));
                        }
                        if (notif.type === "contract_offer") setShowMessages(true);
                      }}>
                        <p className="text-[13px] font-bold text-white mb-1">{notif.title}</p>
                        <p className="text-xs text-white/70 line-clamp-2">{notif.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {userType === "client" && (
          <button
            onClick={() => {
              setActiveTab("myPosts");
              setShowManageProjects(true);
              if (session?.user?.id) {
                if (myPosts.length === 0) {
                  setLoadingMyPosts(true);
                  fetch(`/api/community/projects?userId=${session?.user?.id}`)
                    .then((r) => r.json())
                    .then((data) => { if (data.projects) setMyPosts(data.projects); })
                    .finally(() => setLoadingMyPosts(false));
                }
                setLoadingManagedProjectsContracts(true);
                fetch("/api/community/contracts")
                  .then((r) => r.json())
                  .then((data) => {
                    if (data.contracts) {
                      setManagedProjectContracts(data.contracts.filter((contract: any) => contract.isOngoing));
                    }
                  })
                  .finally(() => setLoadingManagedProjectsContracts(false));
              }
            }}
            className="pointer-events-auto w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center"
            aria-label="Manage Projects"
            title="Manage Projects"
          >
            <FileSignature className="w-4 h-4 text-white/60" />
          </button>
        )}

        {userType === "freelancer" && (
          <button
            onClick={() => {
              setShowManageContracts(true);
              if (!session?.user?.id) return;
              setLoadingContracts(true);
              fetch("/api/community/contracts")
                .then((r) => r.json())
                .then((data) => { if (data.contracts) setContracts(data.contracts); })
                .finally(() => setLoadingContracts(false));
            }}
            className="pointer-events-auto w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center"
            aria-label="Manage Contracts"
            title="Manage Contracts"
          >
            <FileSignature className="w-4 h-4 text-white/60" />
          </button>
        )}

        <button onClick={() => router.push("/")} className="pointer-events-auto w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div data-tour="community-feed" className="fixed inset-0 pt-[72px] flex overflow-hidden">
        <div className="w-80 shrink-0 flex flex-col m-4 mr-0 rounded-[2.5rem] border border-white/[0.08] bg-[#0a0a0a]/70 backdrop-blur-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] relative group transition-all duration-500 hover:border-white/20">
          <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
          
          {userType === "client" || userType === null ? (
            <GlobeAIChat
              globeRef={globeRef}
              onWorkersFound={(workers) => setGlobeWorkers(workers)}
              onMarkerAdd={(marker) => setGlobeMarkers((prev) => [...prev.filter((m) => m.id !== marker.id), marker])}
              onMarkersClear={() => {
                const myLoc = globeMarkers.find((m) => m.id === "__my_location__");
                setGlobeMarkers(myLoc ? [myLoc] : []);
                globeRef.current?.clearMarkers();
                if (myLoc) setTimeout(() => globeRef.current?.addMarker(myLoc), 50);
              }}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col h-full bg-[#0a0a0a]/90 relative z-20">
              <div className="p-5 border-b border-white/[0.08] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-md z-30">
                <h2 className="text-sm font-black uppercase tracking-widest text-white/80 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#22c55e]" /> Nearby Jobs
                </h2>
                <div className="space-y-3">
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <Input 
                      placeholder="Location (e.g. city, area, country)" 
                      value={freelancerLocationFilter}
                      onChange={(e) => setFreelancerLocationFilter(e.target.value)}
                      onFocus={() => {
                        if (suggestions.length > 0 || isSearchingLocations) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        locationBlurTimeoutRef.current = setTimeout(() => {
                          if (!locationSuggestionMouseDownRef.current) {
                            setShowSuggestions(false);
                          }
                          locationSuggestionMouseDownRef.current = false;
                        }, 150);
                      }}
                      className="pl-9 h-10 bg-white/[0.03] border border-white/[0.06] text-xs focus:ring-white/10"
                    />
                    <AnimatePresence>
                      {showSuggestions && userType === "freelancer" && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-0 right-0 top-12 z-[100] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden p-1">
                          {isSearchingLocations && (
                            <div className="px-3 py-2 text-xs text-white/40 flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> Searching locations...
                            </div>
                          )}
                          {!isSearchingLocations && suggestions.length === 0 && freelancerLocationFilter.trim().length >= 2 && (
                            <div className="px-3 py-2 text-xs text-white/35">
                              No matching places found. Try a city, region, neighborhood, or country.
                            </div>
                          )}
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={() => {
                                locationSuggestionMouseDownRef.current = true;
                                if (locationBlurTimeoutRef.current) {
                                  clearTimeout(locationBlurTimeoutRef.current);
                                }
                              }}
                              onClick={() => {
                                setFreelancerLocationFilter(s.value);
                                setShowSuggestions(false);
                                locationSuggestionMouseDownRef.current = false;
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/5 rounded-lg flex items-start gap-2 transition-all"
                            >
                              <MapPin className="w-3 h-3 text-white/30 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{s.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="relative">
                    <ListIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <select 
                      value={freelancerCategoryFilter}
                      onChange={(e) => setFreelancerCategoryFilter(e.target.value)}
                      className="w-full pl-9 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs focus:ring-white/10 text-white appearance-none outline-none"
                    >
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-white/40 pt-1 text-center">Found {filteredProjects.length} posts matching criteria</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No posts matched.</p>
                  </div>
                ) : (
                  filteredProjects.map((p) => {
                    const projectDate = getProjectDateLabel(p);
                    return (
                      <div key={p.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all cursor-pointer group" onClick={() => {
                        setSelectedDetailsProject(p);
                        setShowProjectDetailsModal(true);
                        const marker = globeMarkers.find((mx) => mx.id === `proj_${p.id}`);
                        if (marker) globeRef.current?.flyTo(marker.lat, marker.lng, 2.2);
                      }}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-sm text-white/90 line-clamp-2">{p.title}</h3>
                          <Badge className="bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20 shrink-0 text-[10px] uppercase font-bold px-2 py-0">NEW</Badge>
                        </div>
                        <p className="text-xs text-white/40 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-white/50 mb-2 bg-white/[0.03] p-2 rounded-lg border border-white/[0.04]">
                          <span className="flex items-center gap-1 font-semibold text-white/80"><DollarSign className="w-3 h-3 text-[#f5c518]"/> {p.budget}</span>
                          {p.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-white/40"/> {p.deadline}</span>}
                        </div>
                        {projectDate && (
                          <p className="text-[10px] text-white/35 mb-4">{projectDate.label}: {projectDate.value}</p>
                        )}
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startChatWithFreelancer({ userId: p.userId || "client1", displayName: p.authorName || "Client", userType: "client", location: p.location || null }); setShowMessages(true); }}
                            className="flex-1 h-8 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <MessageCircle className="w-3 h-3" /> Message
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openProfileViewer({ userId: p.userId || "client1", name: p.authorName || "Client", userType: "client", location: p.location || null }); }}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all"
                          >
                            <User className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0">
            <InteractiveGlobe
              ref={globeRef}
              markers={globeMarkers}
              onMarkerClick={(marker) => {
                if (marker.id === "__my_location__") return;
                if (userType === "freelancer" && marker.id.startsWith("proj_")) {
                  const pid = parseInt(marker.id.replace("proj_", ""));
                  const project = filteredProjects.find((p: any) => p.id === pid);
                  if (project) setSelectedGlobeProject(project === selectedGlobeProject ? null : project);
                } else {
                  const worker = globeWorkers.find((w: any) => w.id === marker.id);
                  if (worker) setSelectedGlobeWorker(worker === selectedGlobeWorker ? null : worker);
                }
              }}
              className="w-full h-full"
            />

            <AnimatePresence>
              {globeWorkers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 flex-wrap justify-center"
                  style={{ maxWidth: "calc(100% - 48px)" }}
                >
                  <div
                    className="flex items-center gap-1.5 p-1.5 rounded-full border border-white/10 backdrop-blur-2xl shadow-2xl"
                    style={{ background: "rgba(10,10,10,0.9)" }}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 pl-3 pr-2 shrink-0">
                      {globeWorkers.length} FOUND
                    </span>
                    <div className="flex items-center gap-1 flex-nowrap">
                      {globeWorkers.slice(0, 5).map((worker: any) => (
                        <button
                          key={worker.id}
                          onClick={() => {
                            setSelectedGlobeWorker(selectedGlobeWorker?.id === worker.id ? null : worker);
                            if (worker.lat && worker.lng) globeRef.current?.flyTo(worker.lat, worker.lng, 2.2);
                          }}
                          className={`flex items-center gap-2 pr-3 pl-1 py-1 rounded-full text-[11px] font-semibold transition-all ${
                            selectedGlobeWorker?.id === worker.id
                              ? "bg-gradient-to-r from-[#f5c518] to-[#c8960c] text-black shadow-[0_0_15px_rgba(245,197,24,0.3)]"
                              : "bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                            selectedGlobeWorker?.id === worker.id ? "bg-black/20 text-black" : "bg-white/10 text-white"
                          }`}>
                            {worker.name?.[0] || "W"}
                          </div>
                          {worker.name?.split(" ")[0]}
                        </button>
                      ))}
                      {globeWorkers.length > 5 && (
                        <span className="text-[11px] font-bold text-white/30 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                          +{globeWorkers.length - 5}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setGlobeWorkers([]);
                        setSelectedGlobeWorker(null);
                        const myLoc = globeMarkers.find((m) => m.id === "__my_location__");
                        setGlobeMarkers(myLoc ? [myLoc] : []);
                        globeRef.current?.clearMarkers();
                        if (myLoc) setTimeout(() => globeRef.current?.addMarker(myLoc), 50);
                      }}
                      className="ml-2 mr-2 text-[12px] font-light text-white/30 hover:text-white/80 transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedGlobeWorker && (
                <motion.div
                  key={selectedGlobeWorker.id}
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  className="absolute top-6 right-6 z-30 w-64 rounded-[1.5rem] border border-white/[0.12] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
                  style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(24px)" }}
                >
                  <button
                    onClick={() => setSelectedGlobeWorker(null)}
                    className="absolute top-4 right-4 text-white/30 hover:text-white text-sm transition-colors"
                  >✕</button>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg font-black text-[#f5c518] shrink-0 shadow-inner">
                      {selectedGlobeWorker.name?.[0] || "W"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{selectedGlobeWorker.name}</p>
                      <p className="text-[11px] text-[#f5c518] font-medium flex items-center gap-1 truncate mb-0.5">
                        4.9 ★ <span className="text-white/30 font-normal">| {selectedGlobeWorker.location || "Global"}</span>
                      </p>
                    </div>
                  </div>
                  
                  {selectedGlobeWorker.headline && (
                    <p className="text-[11px] text-white/60 mb-3 leading-relaxed line-clamp-2">{selectedGlobeWorker.headline}</p>
                  )}
                  
                  <div className="text-[10px] text-white/50 mb-4 flex flex-col gap-1.5 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                    <div className="flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
                      <DollarSign className="w-4 h-4 text-[#f5c518]" /> 
                      {selectedGlobeWorker.pricingText || (selectedGlobeWorker.hourlyRate ? `${selectedGlobeWorker.hourlyRate}/hr` : "Rate not specified")}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { startChatWithFreelancer(selectedGlobeWorker); setShowMessages(true); }}
                      className="w-full h-8 rounded-xl text-[11px] font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3 h-3" /> Message
                    </button>
                    <button
                      onClick={() => {
                        openProfileViewer(selectedGlobeWorker);
                      }}
                      className="w-full h-8 rounded-xl text-[11px] font-bold text-black transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 shadow-md shadow-[#f5c518]/20"
                      style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}
                    >
                      <User className="w-3 h-3 black" /> Profile
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {selectedGlobeProject && (
                <motion.div
                  key={"proj_" + selectedGlobeProject.id}
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  className="absolute top-6 right-6 z-30 w-72 rounded-[1.5rem] border border-white/[0.12] p-5 shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
                  style={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(24px)" }}
                >
                  <button
                    onClick={() => setSelectedGlobeProject(null)}
                    className="absolute top-4 right-4 text-white/30 hover:text-white text-sm transition-colors"
                  >✕</button>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-xl font-black text-[#22c55e] shrink-0 shadow-inner">
                      {selectedGlobeProject.authorName?.[0] || "C"}
                    </div>
                    <div className="min-w-0 pr-4">
                      <p className="text-xs font-bold text-[#22c55e] uppercase tracking-wider mb-0.5">Project</p>
                      <p className="text-sm font-bold text-white line-clamp-2">{selectedGlobeProject.title}</p>
                    </div>
                  </div>
                  
                  {selectedGlobeProject.description && (
                    <p className="text-[11px] text-white/60 mb-3 leading-relaxed line-clamp-3">{selectedGlobeProject.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2 text-[10px] text-white/60 mb-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                    <span className="flex items-center gap-1 bg-white/[0.05] px-2 py-1 rounded-md"><DollarSign className="w-3 h-3 text-[#f5c518]"/> {selectedGlobeProject.budget}</span>
                    {selectedGlobeProject.deadline && <span className="flex items-center gap-1 bg-white/[0.05] px-2 py-1 rounded-md"><Clock className="w-3 h-3"/> {selectedGlobeProject.deadline}</span>}
                  </div>
                  {getProjectDateLabel(selectedGlobeProject) && (
                    <p className="text-[10px] text-white/35 mb-4">{getProjectDateLabel(selectedGlobeProject)?.label}: {getProjectDateLabel(selectedGlobeProject)?.value}</p>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { startChatWithFreelancer({ userId: selectedGlobeProject.userId || "client1", displayName: selectedGlobeProject.authorName || "Client", userType: "client", location: selectedGlobeProject.location || null }); setShowMessages(true); }}
                      className="w-full h-8 rounded-xl text-[11px] font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-3 h-3" /> Message Client
                    </button>
                    <button
                      onClick={() => { 
                        openProfileViewer({ userId: selectedGlobeProject.userId || "client1", name: selectedGlobeProject.authorName || "Client", userType: "client", location: selectedGlobeProject.location || null });
                      }}
                      className="w-full h-8 rounded-xl text-[11px] font-bold text-black transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 shadow-md shadow-[#22c55e]/20"
                      style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)" }}
                    >
                      <User className="w-3 h-3 black" /> View Profile
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {activeTab === "offers" && loadingOffers && (
              <div className="col-span-full text-center py-16">
                <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                <p className="text-sm text-white/30">Loading offers...</p>
              </div>
            )}

            {activeTab === "offers" && !loadingOffers && (searchResults !== null && userType === "client" ? searchResults : offers).filter((o) => activeCategory === "all" || o.category === activeCategory).length === 0 && (
              <div className="col-span-full text-center py-16">
                <Package className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-base font-medium text-white/30 mb-1">{searchResults !== null ? "No offers match your search" : "No offers available yet"}</p>
                {searchResults !== null && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-xs text-white/50 hover:text-white mt-2">Clear Search</button>
                )}
              </div>
            )}

            {activeTab === "offers" && !loadingOffers && (searchResults !== null && userType === "client" ? searchResults : offers).filter((o) => activeCategory === "all" || o.category === activeCategory).map((offer: any) => (
              <div key={offer.id} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300">
                <div className="relative h-44 overflow-hidden">
                  {offer.imageUrl ? (
                    <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                      <Package className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.08] backdrop-blur-sm text-white text-xs font-medium">
                    From ${offer.price}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-3 min-w-0">
                    <Avatar className="w-7 h-7 border border-white/10 shrink-0">
                      <AvatarFallback className="text-[10px] bg-white/10">{offer.profile?.displayName?.[0] || "F"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/80 truncate">{offer.profile?.displayName || "Freelancer"}</p>
                      <p className="text-[10px] text-white/30 truncate">{offer.profile?.headline || ""}</p>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2 leading-tight line-clamp-2 group-hover:text-white/80 transition-colors">
                    {offer.title}
                  </h3>
                  {offer.tags && Array.isArray(offer.tags) && offer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {offer.tags.slice(0, 3).map((tag: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="flex flex-col items-start gap-1">
                      <span className="flex items-center gap-1.5 text-xs text-white/30">
                        <Clock className="w-3 h-3" />
                        {offer.deliveryDays} day{offer.deliveryDays !== 1 ? "s" : ""} delivery
                      </span>
                      {formatLocalDateTime(offer.createdAt || offer.postedAt) && (
                        <span className="text-[10px] text-white/25">Posted: {formatLocalDateTime(offer.createdAt || offer.postedAt)}</span>
                      )}
                    </div>
                    <button className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-medium">
                      View Offer <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === "myOffers" && loadingMyOffers && (
              <div className="col-span-full text-center py-16">
                <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                <p className="text-sm text-white/30">Loading your offers...</p>
              </div>
            )}

            {activeTab === "myOffers" && !loadingMyOffers && myOffers.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Package className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-base font-medium text-white/30 mb-1">No offers yet</p>
                <p className="text-sm text-white/20 mb-4">Create your first offer to start attracting clients!</p>
                <button onClick={() => setShowCreateOffer(true)} className="flex items-center gap-2 mx-auto px-4 h-9 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Create Offer
                </button>
              </div>
            )}

            {activeTab === "myOffers" && !loadingMyOffers && myOffers.map((offer: any) => (
              <div key={offer.id} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-white/20 transition-all duration-300">
                <div className="relative h-44 overflow-hidden">
                  {offer.imageUrl ? (
                    <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
                      <Package className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.08] backdrop-blur-sm text-white text-xs font-medium">
                    From ${offer.price}
                  </span>
                  <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[10px] font-medium ${offer.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-white/10 text-white/50 border border-white/[0.08]"}`}>
                    {offer.status === "active" ? "Active" : offer.status || "Active"}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-sm font-bold text-white mb-2 leading-tight">{offer.title}</h3>
                  {offer.description && <p className="text-xs text-white/40 mb-3 line-clamp-2">{offer.description}</p>}
                  {offer.tags && Array.isArray(offer.tags) && offer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {offer.tags.slice(0, 3).map((tag: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <div className="flex flex-col items-start gap-1">
                      <span className="flex items-center gap-1.5 text-xs text-white/30">
                        <Clock className="w-3 h-3" />
                        {offer.deliveryDays} day{offer.deliveryDays !== 1 ? "s" : ""} delivery
                      </span>
                      {formatLocalDateTime(offer.createdAt || offer.postedAt) && (
                        <span className="text-[10px] text-white/25">Posted: {formatLocalDateTime(offer.createdAt || offer.postedAt)}</span>
                      )}
                    </div>
                    <button
                      className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/community/offers?id=${offer.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setMyOffers((prev) => prev.filter((o) => o.id !== offer.id));
                            setOffers((prev) => prev.filter((o) => o.id !== offer.id));
                            toast.success("Offer deleted");
                          }
                        } catch { toast.error("Failed to delete"); }
                      }}
                    >
                      <X className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === "projects" && (searchResults !== null ? searchResults : [...dbProjects, ...PROJECTS].filter((p) => activeCategory === "all" || p.category === activeCategory)).length === 0 && (
              <div className="col-span-full text-center py-16">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-base font-medium text-white/30">{searchResults !== null ? "No projects match your search" : "No projects yet"}</p>
                {searchResults !== null && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-xs text-white/50 hover:text-white mt-2">Clear Search</button>
                )}
              </div>
            )}

            {activeTab === "projects" && (searchResults !== null ? searchResults : [...dbProjects, ...PROJECTS].filter((p) => activeCategory === "all" || p.category === activeCategory)).map((project: any) => {
              const projectDate = getProjectDateLabel(project);
              return (
                <div key={project.id} className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium">{project.budget}</span>
                    <div className="text-right">
                      <span className="text-[10px] text-white/25 font-medium uppercase tracking-widest">{project.posted}</span>
                      {projectDate && <p className="text-[10px] text-white/25 mt-1">{projectDate.value}</p>}
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{project.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-2">{project.description}</p>
                  {project.skills && Array.isArray(project.skills) && project.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {project.skills.slice(0, 4).map((skill: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{skill}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span className="flex items-center gap-1">
                        <FileSignature className="w-3.5 h-3.5" />
                        Contract-based
                      </span>
                      {project.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {project.deadline}
                        </span>
                      )}
                    </div>
                    <button
                      className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all"
                      onClick={() => openContractForProject(project)}
                    >
                      Send Contract
                    </button>
                  </div>
                </div>
              );
            })}

            {activeTab === "freelancers" && freelancers.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Users className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-base font-medium text-white/30 mb-1">No freelancers yet</p>
                <p className="text-sm text-white/20">Be the first to join as a freelancer!</p>
              </div>
            )}

            {activeTab === "freelancers" && freelancers.map((freelancer) => (
              <div key={freelancer.id} className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300">
                {freelancer.portfolio && freelancer.portfolio.length > 0 ? (
                  <div className="relative h-36 overflow-hidden grid grid-cols-3 gap-0.5">
                    {freelancer.portfolio.slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className={`relative overflow-hidden ${freelancer.portfolio.length === 1 ? "col-span-3" : idx === 0 && freelancer.portfolio.length === 2 ? "col-span-2" : ""}`}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-36 flex items-center justify-center bg-white/[0.03]">
                            <LinkIcon className="w-5 h-5 text-white/10" />
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {freelancer.portfolio.length > 3 && (
                      <div className="absolute bottom-2 right-2 text-[10px] text-white/60 font-medium bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        +{freelancer.portfolio.length - 3} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-20 flex items-center justify-center bg-white/[0.02]">
                    <ImageIcon className="w-7 h-7 text-white/[0.06]" />
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <Avatar className="w-9 h-9 border border-white/10">
                      <AvatarImage src={freelancer.userImage || ""} />
                      <AvatarFallback className="text-xs bg-white/10">{freelancer.displayName?.[0] || "F"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{freelancer.displayName}</p>
                      {freelancer.location && (
                        <p className="flex items-center gap-1 text-[11px] text-white/30">
                          <MapPin className="w-3 h-3" />{freelancer.location}
                        </p>
                      )}
                    </div>
                    {(freelancer.pricingText || freelancer.hourlyRate) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50 shrink-0">
                        {freelancer.pricingText || `${freelancer.hourlyRate}/hr`}
                      </span>
                    )}
                  </div>

                  {freelancer.headline && (
                    <p className="text-xs text-white/60 mb-2 line-clamp-1">{freelancer.headline}</p>
                  )}

                  {freelancer.skills && Array.isArray(freelancer.skills) && freelancer.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {freelancer.skills.slice(0, 4).map((skill: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{skill}</span>
                      ))}
                      {freelancer.skills.length > 4 && <span className="text-[10px] text-white/20">+{freelancer.skills.length - 4}</span>}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-xs text-white/30">
                      <Briefcase className="w-3 h-3" />
                      {freelancer.portfolio?.length || 0} works
                    </span>
                    <div className="flex items-center gap-2">
                      {userType === "client" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startChatWithFreelancer(freelancer); }}
                          className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Chat
                        </button>
                      )}
                      <button
                        onClick={() => openFreelancerPortfolio(freelancer)}
                        className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors font-medium"
                      >
                        Portfolio <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === "myPosts" && loadingMyPosts && (
              <div className="col-span-full text-center py-16">
                <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                <p className="text-sm text-white/30">Loading your projects...</p>
              </div>
            )}

            {activeTab === "myPosts" && !loadingMyPosts && myPosts.length === 0 && (
              <div className="col-span-full text-center py-16">
                <Briefcase className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-base font-medium text-white/30 mb-1">No projects posted yet</p>
                <p className="text-sm text-white/20 mb-4">Post your first project to find talented freelancers!</p>
                <button onClick={() => setShowCreateProject(true)} className="flex items-center gap-2 mx-auto px-4 h-9 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Post a Project
                </button>
              </div>
            )}

            {activeTab === "myPosts" && !loadingMyPosts && myPosts.map((project: any) => {
              const projectDate = getProjectDateLabel(project);
              return (
                <div key={project.id} className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium">{project.budget}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${project.status === "open" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.05] text-white/30 border border-white/[0.06]"}`}>
                      {project.status === "open" ? "Open" : project.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{project.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed mb-3 line-clamp-2">{project.description}</p>
                  {projectDate && <p className="text-[10px] text-white/25 mb-4">{projectDate.label}: {projectDate.value}</p>}
                  {project.skills && Array.isArray(project.skills) && project.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {project.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{skill}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-white/30">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{project.proposals || 0} proposals</span>
                      {project.deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{project.deadline}</span>}
                    </div>
                    <button
                      className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/community/projects?id=${project.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setMyPosts((prev) => prev.filter((p) => p.id !== project.id));
                            toast.success("Project closed");
                          }
                        } catch { toast.error("Failed to close project"); }
                      }}
                    >
                      <X className="w-3 h-3" /> Close
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCreateOffer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowCreateOffer(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><Package className="w-4 h-4 text-white/60" /></div>
                  <h2 className="text-base font-bold text-white">Create New Offer</h2>
                </div>
                <button onClick={() => setShowCreateOffer(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Offer Title *</Label>
                  <Input placeholder="e.g., Full-Stack Web Development with Next.js" value={newOffer.title} onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })} className={inp} />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Description</Label>
                  <textarea placeholder="Describe what you're offering in detail..." value={newOffer.description} onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })} rows={3} className={textarea} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Category *</Label>
                    <select value={newOffer.category} onChange={(e) => setNewOffer({ ...newOffer, category: e.target.value })} className={selectCls}>
                      <option value="">Select category</option>
                      {OFFER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Price ($) *</Label>
                    <Input type="number" placeholder="e.g., 100" value={newOffer.price} onChange={(e) => setNewOffer({ ...newOffer, price: e.target.value })} className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Delivery Days *</Label>
                    <Input type="number" placeholder="e.g., 5" value={newOffer.deliveryDays} onChange={(e) => setNewOffer({ ...newOffer, deliveryDays: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Tags (comma separated)</Label>
                    <Input placeholder="e.g., React, Next.js" value={newOffer.tags} onChange={(e) => setNewOffer({ ...newOffer, tags: e.target.value })} className={inp} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Cover Image</Label>
                  {offerImageUrl ? (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-white/[0.08]">
                      <img src={offerImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setOfferImageUrl("")} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="border border-white/[0.08] rounded-xl p-4 bg-white/[0.02]">
                      <input ref={offerImageRef} type="file" accept="image/*" onChange={handleOfferImageUpload} className="hidden" />
                      <button onClick={() => offerImageRef.current?.click()} className="w-full h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs text-white/70">
                        <Upload className="w-4 h-4" /> Upload Image
                      </button>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <Button disabled={creatingOffer} onClick={handleCreateOffer} className="w-full h-10 rounded-xl font-bold text-black" style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}>
                    {creatingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Offer"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManageContracts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowManageContracts(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><FileSignature className="w-4 h-4 text-white/60" /></div>
                  <h2 className="text-base font-bold text-white">Manage Contracts</h2>
                </div>
                <button onClick={() => setShowManageContracts(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6">
                {loadingContracts && (
                  <div className="text-center py-10">
                    <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                    <p className="text-sm text-white/30">Loading your contracts...</p>
                  </div>
                )}

                {!loadingContracts && contracts.length === 0 && (
                  <div className="text-center py-10">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-white/10" />
                    <p className="text-base font-medium text-white/30 mb-1">No contracts yet</p>
                    <p className="text-sm text-white/20">Contract offers will appear here.</p>
                  </div>
                )}

                {!loadingContracts && contracts.length > 0 && (
                  <div className="space-y-4">
                    {contracts.map((c: any) => {
                      const contractDate = getContractDateLabel(c);
                      return (
                        <div key={c.contractId || c.id} className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-white truncate">{c.title || "Contract"}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium border ${
                                  c.status === "accepted"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : c.status === "pending"
                                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                      : "bg-white/[0.05] text-white/40 border-white/[0.08]"
                                }`}>
                                  {c.status === "accepted" ? "Ongoing" : c.status}
                                </span>
                              </div>
                              <p className="text-xs text-white/60 mt-1">With {c.partnerName || "Client"}</p>
                              {c.description && (
                                <p className="text-xs text-white/40 mt-2 line-clamp-3 whitespace-pre-wrap">{c.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-white/35">
                                {c.amount && <span>Amount: ${c.amount}</span>}
                                {c.timeline && <span>Timeline: {c.timeline}</span>}
                                {contractDate && <span>{contractDate.label}: {contractDate.value}</span>}
                              </div>
                            </div>
                            <button
                              className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors shrink-0"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/community/messages?conversationKey=${encodeURIComponent(c.conversationKey)}`, { method: "DELETE" });
                                  if (res.ok) {
                                    setContracts((prev) => prev.filter((x) => x.contractId !== c.contractId));
                                    toast.success("Contract canceled");
                                  } else {
                                    const data = await res.json().catch(() => null);
                                    toast.error(data?.error || "Failed to cancel");
                                  }
                                } catch {
                                  toast.error("Failed to cancel");
                                }
                              }}
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManageProjects && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowManageProjects(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><FileSignature className="w-4 h-4 text-white/60" /></div>
                  <h2 className="text-base font-bold text-white">Manage Projects</h2>
                </div>
                <button onClick={() => setShowManageProjects(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <FileSignature className="w-4 h-4 text-[#f5c518]" />
                    <h3 className="text-sm font-bold text-white">Ongoing Contracts</h3>
                  </div>

                  {loadingManagedProjectsContracts && (
                    <div className="text-center py-8">
                      <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-white/20" />
                      <p className="text-sm text-white/30">Loading ongoing contracts...</p>
                    </div>
                  )}

                  {!loadingManagedProjectsContracts && managedProjectContracts.length === 0 && (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                      <p className="text-sm font-medium text-white/40">No ongoing contracts yet</p>
                      <p className="text-xs text-white/25 mt-1">Accepted contracts with freelancers will appear here automatically.</p>
                    </div>
                  )}

                  {!loadingManagedProjectsContracts && managedProjectContracts.length > 0 && (
                    <div className="space-y-4">
                      {managedProjectContracts.map((contract: any) => {
                        const contractDate = getContractDateLabel(contract);
                        return (
                          <div key={contract.contractId || contract.id} className="p-5 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] hover:border-emerald-500/30 transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-white truncate">{contract.title || "Contract"}</p>
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Ongoing
                                  </span>
                                </div>
                                <p className="text-xs text-white/60 mt-1">With {contract.partnerName || "Freelancer"}</p>
                                {contract.description && (
                                  <p className="text-xs text-white/40 mt-2 line-clamp-3 whitespace-pre-wrap">{contract.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-white/35">
                                  {contract.amount && <span>Amount: £{contract.amount}</span>}
                                  {contract.timeline && <span>Timeline: {contract.timeline}</span>}
                                  {contractDate && <span>{contractDate.label}: {contractDate.value}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Release Money Section */}
                            {contract.isOngoing && userType === "client" && (
                              <div className="mt-4 pt-4 border-t border-emerald-500/10">
                                {showReleaseConfirm === contract.contractId ? (
                                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-3">
                                    <div className="flex items-start gap-2">
                                      <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-xs font-bold text-emerald-300">Confirm Release</p>
                                        <p className="text-[11px] text-white/50 mt-1">
                                          This will release <strong className="text-white">£{contract.amount}</strong> to {contract.partnerName || "the freelancer"}&apos;s balance. This action cannot be undone.
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setShowReleaseConfirm(null)}
                                        className="flex-1 h-9 rounded-lg border border-white/10 text-xs font-semibold text-white/60 hover:bg-white/5 transition-all"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleReleaseMoney(contract.contractId)}
                                        disabled={releasingContractId === contract.contractId}
                                        className="flex-1 h-9 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                                      >
                                        {releasingContractId === contract.contractId ? (
                                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                                        ) : (
                                          <><Banknote className="w-3.5 h-3.5" /> Release £{contract.amount}</>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowReleaseConfirm(contract.contractId)}
                                    className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-xs font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                                  >
                                    <Banknote className="w-4 h-4" /> Release Money (£{contract.amount})
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  {loadingMyPosts && (
                    <div className="text-center py-10">
                      <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                      <p className="text-sm text-white/30">Loading your projects...</p>
                    </div>
                  )}

                  {!loadingMyPosts && myPosts.length === 0 && (
                    <div className="text-center py-10">
                      <Briefcase className="w-10 h-10 mx-auto mb-3 text-white/10" />
                      <p className="text-base font-medium text-white/30 mb-1">No projects posted yet</p>
                      <p className="text-sm text-white/20 mb-4">Post your first project to find talented freelancers!</p>
                      <button onClick={() => { setShowManageProjects(false); setShowCreateProject(true); }} className="flex items-center gap-2 mx-auto px-4 h-9 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all">
                        <Plus className="w-3.5 h-3.5" /> Post a Project
                      </button>
                    </div>
                  )}

                  {!loadingMyPosts && myPosts.length > 0 && (
                    <div className="space-y-4">
                      {myPosts.map((project: any) => {
                        const projectDate = getProjectDateLabel(project);
                        return (
                          <div key={project.id} className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 transition-all duration-300">
                            <div className="flex justify-between items-start mb-3">
                              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium">{project.budget}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${project.status === "open" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/[0.05] text-white/30 border border-white/[0.06]"}`}>
                                {project.status === "open" ? "Open" : project.status}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white mb-2">{project.title}</h3>
                            <p className="text-xs text-white/40 leading-relaxed mb-3 line-clamp-2">{project.description}</p>
                            {projectDate && <p className="text-[10px] text-white/25 mb-4">{projectDate.label}: {projectDate.value}</p>}
                            {project.skills && Array.isArray(project.skills) && project.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {project.skills.map((skill: string, idx: number) => (
                                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06]">{skill}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-xs text-white/30">
                                <span className="flex items-center gap-1"><FileSignature className="w-3.5 h-3.5" />Contract-based</span>
                                {project.deadline && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{project.deadline}</span>}
                              </div>
                              <button
                                className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/community/projects?id=${project.id}`, { method: "DELETE" });
                                    if (res.ok) {
                                      setMyPosts((prev) => prev.filter((p) => p.id !== project.id));
                                      toast.success("Project closed");
                                    }
                                  } catch { toast.error("Failed to close project"); }
                                }}
                              >
                                <X className="w-3 h-3" /> Close
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowCreateProject(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><Briefcase className="w-4 h-4 text-white/60" /></div>
                  <h2 className="text-base font-bold text-white">Post a New Project</h2>
                </div>
                <button onClick={() => setShowCreateProject(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Project Title *</Label>
                  <Input placeholder="e.g., Build a Custom AI Agent for Real Estate" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} className={inp} />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Description</Label>
                  <textarea placeholder="Describe your project requirements in detail..." value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} rows={4} className={textarea} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Category *</Label>
                    <select value={newProject.category} onChange={(e) => setNewProject({ ...newProject, category: e.target.value })} className={selectCls}>
                      <option value="">Select category</option>
                      {OFFER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Budget *</Label>
                    <Input placeholder="e.g., $500 - $1,000" value={newProject.budget} onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })} className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Deadline (optional)</Label>
                    <Input placeholder="e.g., 2 weeks" value={newProject.deadline} onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Location (optional)</Label>
                    <Input placeholder="e.g., Dhaka, Bangladesh" value={newProject.location} onChange={(e) => setNewProject({ ...newProject, location: e.target.value })} className={inp} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Required Skills</Label>
                  <Input placeholder="e.g., React, Python, AI" value={newProject.skills} onChange={(e) => setNewProject({ ...newProject, skills: e.target.value })} className={inp} />
                </div>
              </div>
              <div className={modalFooter}>
                <button onClick={handleCreateProject} disabled={!newProject.title || !newProject.category || !newProject.budget || creatingProject} className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-40">
                  {creatingProject ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Posting...</span> : "Post Project"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {showContractModal && profileViewerData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={() => setShowContractModal(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08]"><FileText className="w-4 h-4 text-white/60" /></div>
                  <h2 className="text-base font-bold text-white">Create Contract for {profileViewerData.name || profileViewerData.displayName}</h2>
                </div>
                <button onClick={() => setShowContractModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Contract Title *</Label>
                  <Input
                    placeholder="e.g., Landing page redesign"
                    value={contractForm.title}
                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Contract Description *</Label>
                  <textarea 
                    placeholder="Describe the scope of work, deliverables, and timeline..." 
                    value={contractForm.description} 
                    onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })} 
                    rows={6} 
                    className={textarea} 
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Contract Timeline</Label>
                  <Input
                    placeholder="e.g., Start: Mar 10, End: Apr 10"
                    value={contractForm.timeline}
                    onChange={(e) => setContractForm({ ...contractForm, timeline: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Milestones</Label>
                  <textarea
                    placeholder="e.g., Milestone 1: Wireframes (Mar 15)\nMilestone 2: UI (Mar 25)"
                    value={contractForm.milestones}
                    onChange={(e) => setContractForm({ ...contractForm, milestones: e.target.value })}
                    rows={4}
                    className={textarea}
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Contract Amount ($) *</Label>
                  <Input 
                    type="number" 
                    placeholder="e.g., 500" 
                    value={contractForm.amount} 
                    onChange={(e) => setContractForm({ ...contractForm, amount: e.target.value })} 
                    className={inp} 
                  />
                </div>
              </div>
              <div className={modalFooter}>
                <button 
                  onClick={handleSendContract} 
                  disabled={!contractForm.title || !contractForm.description || !contractForm.amount || submittingContract} 
                  className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-40"
                >
                  {submittingContract ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending...</span> : "Send Contract Offer"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedFreelancer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setSelectedFreelancer(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[2rem] bg-[#0a0a0a] border border-white/[0.08]">
              <div className={modalHeader}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                    <AvatarImage src={selectedFreelancer.userImage || ""} />
                    <AvatarFallback className="bg-white/10 text-sm">{selectedFreelancer.displayName?.[0] || "F"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-white truncate">{selectedFreelancer.displayName}</h2>
                    <p className="text-xs text-white/40 truncate">{selectedFreelancer.headline || "Freelancer"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {userType === "client" && (
                    <button onClick={() => { setSelectedFreelancer(null); startChatWithFreelancer(selectedFreelancer); }} className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all">
                      <MessageCircle className="w-3.5 h-3.5" /> Message
                    </button>
                  )}
                  <button onClick={() => setSelectedFreelancer(null)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedFreelancer.location && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] text-white/30 mb-0.5">Location</p>
                      <p className="text-xs text-white/70 font-medium flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedFreelancer.location}</p>
                    </div>
                  )}
                  {(selectedFreelancer.pricingText || selectedFreelancer.hourlyRate) && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] text-white/30 mb-0.5">Rate</p>
                      <p className="text-xs text-white/70 font-medium flex items-center gap-1"><DollarSign className="w-3 h-3" />{selectedFreelancer.pricingText || `${selectedFreelancer.hourlyRate}/hr`}</p>
                    </div>
                  )}
                  {selectedFreelancer.availability && (
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] text-white/30 mb-0.5">Availability</p>
                      <p className="text-xs text-white/70 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{selectedFreelancer.availability}</p>
                    </div>
                  )}
                </div>

                {selectedFreelancer.bio && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-2">About</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{selectedFreelancer.bio}</p>
                  </div>
                )}

                {selectedFreelancer.skills && Array.isArray(selectedFreelancer.skills) && selectedFreelancer.skills.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedFreelancer.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/60">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {freelancerPortfolio.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 mb-3">Portfolio</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {freelancerPortfolio.map((item: any) => (
                        <div key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden group">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-full h-36 object-cover transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-36 flex items-center justify-center bg-white/[0.02]">
                              <ImageIcon className="w-8 h-8 text-white/10" />
                            </div>
                          )}
                          <div className="p-3">
                            <p className="text-sm font-semibold text-white/80 mb-0.5">{item.title}</p>
                            {item.description && <p className="text-xs text-white/40 line-clamp-2">{item.description}</p>}
                            {item.linkUrl && (
                              <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors">
                                <LinkIcon className="w-3 h-3" /> View Project
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {freelancerPortfolio.length === 0 && (
                  <div className="text-center py-8">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 text-white/10" />
                    <p className="text-sm text-white/30">No portfolio items yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMessages && (
          <motion.div initial={{ opacity: 0, x: 400 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 400 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-sm bg-[#080808] border-l border-white/[0.08] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              {activeConversation ? (
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button onClick={() => setActiveConversation(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"><ArrowLeft className="w-4 h-4 text-white/50" /></button>
                  <Avatar className="w-9 h-9 border border-white/10 shrink-0 shadow-xl shadow-black">
                    <AvatarImage src={activeConversation.partnerImage || ""} />
                    <AvatarFallback className="text-sm font-bold bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/30">
                      {activeConversation.partnerName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{activeConversation.partnerName}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-[10px] truncate flex items-center gap-1 ${getPresenceMeta(activeConversation).textClassName}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getPresenceMeta(activeConversation).dotClassName}`}></span>
                        {getPresenceMeta(activeConversation).label}
                      </p>
                      <button
                        onClick={() => openProfileViewer({
                          partnerId: activeConversation.partnerId,
                          partnerName: activeConversation.partnerName,
                          partnerImage: activeConversation.partnerImage,
                          partnerHeadline: activeConversation.partnerHeadline,
                          partnerType: activeConversation.partnerType,
                        })}
                        className="h-6 px-2.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] font-semibold text-white/75 hover:text-white hover:bg-white/[0.1] transition-all flex items-center gap-1 shrink-0"
                      >
                        <User className="w-3 h-3" /> View Profile
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-white">Messages</p>
                  {unreadCount > 0 && <p className="text-[10px] text-white/40">{unreadCount} unread</p>}
                </div>
              )}
              <button onClick={() => { setShowMessages(false); setActiveConversation(null); }} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors shrink-0"><X className="w-4 h-4 text-white/50" /></button>
            </div>

            {!activeConversation ? (
              <div className="flex-1 overflow-y-auto">
                {loadingConversations ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-10 h-10 mx-auto mb-3 text-white/10" />
                    <p className="text-sm text-white/30">No conversations yet</p>
                  </div>
                ) : (
                  conversations.map((conv, idx) => (
                    <div key={idx} className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                      <div className="flex items-start gap-2 p-4">
                        <button onClick={() => openConversation(conv)} className="flex-1 flex items-start gap-3 min-w-0 text-left">
                          <Avatar className="w-9 h-9 shrink-0 border border-white/10">
                            <AvatarImage src={conv.partnerImage || ""} />
                            <AvatarFallback className="text-xs bg-white/10">{conv.partnerName?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <p className="text-sm font-medium text-white/80 truncate flex-1 min-w-0">{conv.partnerName}</p>
                              {conv.unreadCount > 0 && (
                                <span className="min-w-4 h-4 px-1 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">
                                  {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/30 truncate mt-1 pr-2">{formatConversationPreview(conv.lastMessage)}</p>
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteConversation(conv); }}
                          className="shrink-0 p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                          title="Hide conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingChat ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-white/20" /></div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center py-8"><p className="text-sm text-white/30">No messages yet. Say hi!</p></div>
                  ) : (
                    chatMessages.map((msg: any, idx: number) => {
                      const isMe = msg.senderId === (session?.user?.id || "mock-user");
                      const contractOffer = parseContractOfferMessage(msg.message);
                      const contractEvent = parseContractEventMessage(msg.message);
                      const contractStatus = contractOffer
                        ? chatMessages
                            .map((candidate: any) => parseContractEventMessage(candidate.message))
                            .find((candidate: any) => candidate?.contractId === contractOffer.contractId)
                        : null;
                      const shouldHidePlainMessage = Boolean(contractOffer || contractEvent);
                      const messageText = !shouldHidePlainMessage && (msg.message && typeof msg.message === "string" && msg.message.trim()) ? msg.message.trim() : "";

                      let attachments = msg.attachments;
                      if (typeof attachments === "string") {
                        try {
                          attachments = JSON.parse(attachments);
                        } catch {
                          attachments = null;
                        }
                      }

                      const hasStructuredCard = Boolean(contractOffer || contractEvent);

                      return (
                        <div key={msg.id ?? msg.clientTempId ?? `${msg.createdAt}-${idx}`} className={`flex w-full items-end ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`w-fit ${isMe ? "ml-auto max-w-[98%]" : "mr-auto max-w-[94%]"} flex flex-col gap-1 text-sm ${hasStructuredCard ? "px-0 py-0 bg-transparent border-0" : `px-3 py-2 rounded-2xl ${isMe ? "bg-white text-black" : "bg-white/[0.08] text-white/80 border border-white/[0.06]"}`}`}>
                            {attachments && Array.isArray(attachments) && attachments.length > 0 && (
                              <div className="flex flex-col gap-2 mt-1 mb-1">
                                {attachments.map((att: any, aIdx: number) => {
                                  const fileType = typeof att?.type === "string" ? att.type : "";
                                  const fileName = typeof att?.name === "string" ? att.name : "attachment";
                                  const rawUrl = typeof att?.url === "string" ? att.url : "";
                                  const lowerName = fileName.toLowerCase();
                                  const isImage = fileType.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lowerName);
                                  const isVideo = fileType.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(lowerName);
                                  const isPdf = fileType === "application/pdf" || /\.pdf$/i.test(lowerName);
                                  const isDocument =
                                    isPdf ||
                                    fileType.includes("document") ||
                                    fileType.includes("text") ||
                                    /\.(docx?|xlsx?|pptx?|txt|csv|rtf|json)$/i.test(lowerName);
                                  const attachmentApiUrl = msg?.id ? `/api/community/attachments?messageId=${msg.id}&attachmentIndex=${aIdx}` : "";
                                  const hasInlineDataUrl = rawUrl.startsWith("data:");
                                  const previewUrl = hasInlineDataUrl ? rawUrl : (attachmentApiUrl || rawUrl);
                                  const directDownloadUrl = msg?.id ? `/api/community/attachments?messageId=${msg.id}&attachmentIndex=${aIdx}&download=1` : rawUrl;
                                  const fileSizeKB = att?.size && Number.isFinite(att.size)
                                    ? Math.max(1, Math.ceil(att.size / 1024))
                                    : hasInlineDataUrl
                                      ? Math.max(1, Math.ceil((rawUrl.length / 1024) * 0.75))
                                      : null;

                                  return (
                                    <div key={aIdx}>
                                      {isImage && (
                                        <div className="group/attachment relative rounded-lg overflow-hidden border border-white/10">
                                          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">
                                            <img src={previewUrl} alt={fileName} className="max-w-full max-h-80 rounded-lg" />
                                          </a>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerAttachmentDownload(directDownloadUrl, fileName);
                                            }}
                                            className="absolute top-2 right-2 opacity-0 group-hover/attachment:opacity-100 transition-opacity w-8 h-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white z-10"
                                            title="Download file"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                          </button>
                                          <div className="p-2 flex items-center justify-between bg-black/20">
                                            <p className="text-xs truncate text-white/70">{fileName}</p>
                                            <p className="text-xs text-white/50 ml-2">{fileSizeKB ? `${fileSizeKB} KB` : "File"}</p>
                                          </div>
                                        </div>
                                      )}

                                      {isVideo && (
                                        <div className="group/attachment relative rounded-lg overflow-hidden border border-white/10 bg-black/40">
                                          <video controls className="max-w-full max-h-80 rounded-lg bg-black" src={previewUrl} />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerAttachmentDownload(directDownloadUrl, fileName);
                                            }}
                                            className="absolute top-2 right-2 opacity-0 group-hover/attachment:opacity-100 transition-opacity w-8 h-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white z-10"
                                            title="Download file"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                          </button>
                                          <div className="p-2 flex items-center justify-between bg-black/20">
                                            <p className="text-xs truncate text-white/70">{fileName}</p>
                                            <p className="text-xs text-white/50 ml-2">{fileSizeKB ? `${fileSizeKB} KB` : "File"}</p>
                                          </div>
                                        </div>
                                      )}

                                      {!isImage && !isVideo && (
                                        <div className={`group/attachment relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all hover:scale-105 ${isMe ? "bg-black/5 border-black/10 hover:bg-black/10" : "bg-black/20 border-white/10 hover:bg-black/40"}`}>
                                          <a
                                            href={directDownloadUrl}
                                            download={fileName}
                                            className="absolute inset-0 rounded-xl z-0"
                                            aria-label={`Download ${fileName || "file"}`}
                                          />
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative z-10 ${isMe ? "bg-black/10" : "bg-white/10"}`}>
                                            {isDocument ? (
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 3a2 2 0 012-2h6a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V13a2 2 0 01-2 2H6a2 2 0 01-2-2zm2 5a1 1 0 000 2h6a1 1 0 000-2H6z" />
                                              </svg>
                                            ) : (
                                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 1.4A1 1 0 0116 10.5V12a6 6 0 01-6 6H9a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a3 3 0 01-3-3v-1z" />
                                              </svg>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0 relative z-10">
                                            <p className="font-semibold text-[13px] truncate">{fileName || "Download"}</p>
                                            <p className={`text-[10px] uppercase tracking-wider ${isMe ? "text-black/50" : "text-white/40"}`}>
                                              {isDocument ? "Document" : "File"}{fileSizeKB ? ` • ${fileSizeKB} KB` : ""}
                                            </p>
                                          </div>
                                          <div className="relative z-10 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerAttachmentDownload(directDownloadUrl, fileName);
                                            }}
                                            className="opacity-0 group-hover/attachment:opacity-100 transition-opacity w-7 h-7 rounded-full bg-black/70 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white"
                                            title="Download file"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                          </button>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {contractOffer && (
                              <div className={`min-w-[260px] max-w-[420px] rounded-[1.25rem] overflow-hidden ${isMe ? "bg-black text-white" : "bg-gradient-to-br from-white/[0.09] via-white/[0.07] to-white/[0.04] text-white border border-white/[0.08]"}`}>
                                <div className={`px-4 py-3 border-b ${isMe ? "border-white/10 bg-white/5" : "border-white/[0.08] bg-white/[0.04]"}`}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isMe ? "bg-[#f5c518] text-black" : "bg-[#f5c518]/15 text-[#f5c518]"}`}>
                                        <FileSignature className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className={`text-[10px] uppercase tracking-[0.25em] ${isMe ? "text-white/60" : "text-white/40"}`}>Contract Offer</p>
                                        <p className="text-sm font-semibold">{contractOffer.title}</p>
                                      </div>
                                    </div>
                                    <div className={`text-right ${isMe ? "text-white" : "text-[#f5c518]"}`}>
                                      <p className={`text-[10px] uppercase tracking-[0.2em] ${isMe ? "text-white/55" : "text-white/35"}`}>Amount</p>
                                      <p className="text-base font-black">${contractOffer.amount}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="px-4 py-3 space-y-3">
                                  {(contractOffer.timeline || contractOffer.milestones) && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {contractOffer.timeline && (
                                        <div className={`rounded-xl px-3 py-2 ${isMe ? "bg-white/5" : "bg-black/20 border border-white/[0.06]"}`}>
                                          <p className={`text-[10px] uppercase tracking-[0.2em] ${isMe ? "text-white/50" : "text-white/35"}`}>Timeline</p>
                                          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{contractOffer.timeline}</p>
                                        </div>
                                      )}
                                      {contractOffer.milestones && (
                                        <div className={`rounded-xl px-3 py-2 ${isMe ? "bg-white/5" : "bg-black/20 border border-white/[0.06]"}`}>
                                          <p className={`text-[10px] uppercase tracking-[0.2em] ${isMe ? "text-white/50" : "text-white/35"}`}>Milestones</p>
                                          <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{contractOffer.milestones}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {contractOffer.description && (
                                    <div className={`rounded-xl px-3 py-3 ${isMe ? "bg-white/5" : "bg-black/20 border border-white/[0.06]"}`}>
                                      <p className={`text-[10px] uppercase tracking-[0.2em] ${isMe ? "text-white/50" : "text-white/35"}`}>Scope</p>
                                      <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{contractOffer.description}</p>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-2 text-[10px] text-white/40">
                                    <span>Created</span>
                                    <span>{formatLocalDateTime(contractOffer.createdAt) || "Just now"}</span>
                                  </div>

                                  {contractStatus ? (
                                    contractStatus.action === "accepted" && !(
                                      chatEscrowMap[contractOffer.contractId] === "funded" ||
                                      chatEscrowMap[contractOffer.contractId] === "released" ||
                                      chatEscrowMap[contractOffer.contractId] === "completed"
                                    ) ? (
                                      // Accepted but escrow not funded yet
                                      userType === "client" ? (
                                        <div className="flex justify-end gap-2 pt-1">
                                          <button
                                            type="button"
                                            disabled={contractActionLoadingId === contractOffer.contractId}
                                            onClick={() => {
                                              setEscrowContract(contractOffer);
                                              setEscrowMsg(msg);
                                              setShowEscrowModal(true);
                                              try {
                                                fetch("/api/community/payment-methods/stripe")
                                                  .then((r) => r.json())
                                                  .then((data) => {
                                                    if (data.paymentMethods) {
                                                      setSavedPaymentMethods(data.paymentMethods);
                                                      if (data.paymentMethods.length > 0) {
                                                        setSelectedPaymentMethod(data.paymentMethods[0].id);
                                                      }
                                                    }
                                                  });
                                              } catch {}
                                            }}
                                            className="h-8 rounded-lg px-3 text-[11px] font-semibold text-black bg-[#f5c518] hover:bg-[#e6b910] disabled:opacity-50"
                                          >
                                            Proceed to Fund Escrow
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 bg-amber-500/15 text-amber-300 border border-amber-500/20">
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            <div>
                                              <p className="text-xs font-semibold">Waiting for client to fund escrow</p>
                                              <p className="text-[11px] opacity-80">The client needs to complete payment for this contract to become active</p>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    ) : (
                                      <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${contractStatus.action === "accepted" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : contractStatus.action === "declined" ? "bg-rose-500/15 text-rose-300 border border-rose-500/20" : "bg-amber-500/15 text-amber-300 border border-amber-500/20"}`}>
                                        <div className="flex items-center gap-2">
                                          {contractStatus.action === "accepted" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                          <div>
                                            <p className="text-xs font-semibold">
                                              {contractStatus.action === "accepted" ? "Contract Active" : contractStatus.action === "declined" ? "Contract declined" : "Contract cancelled"}
                                            </p>
                                            <p className="text-[11px] opacity-80">
                                              {contractStatus.actorName ? `${contractStatus.actorName} ` : ""}{contractStatus.action === "accepted" ? "approved and funded this offer" : contractStatus.action === "declined" ? "declined this offer" : "cancelled this offer"}
                                            </p>
                                          </div>
                                        </div>
                                        {contractStatus.actedAt && (
                                          <span className="text-[10px] opacity-70 whitespace-nowrap">
                                            {new Date(contractStatus.actedAt).toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  ) : isMe ? (
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        disabled={contractActionLoadingId === contractOffer.contractId}
                                        onClick={() => handleContractAction(msg, "cancelled")}
                                        className="h-8 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-50"
                                      >
                                        {contractActionLoadingId === contractOffer.contractId ? "Please wait..." : "Cancel Contract"}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        disabled={contractActionLoadingId === contractOffer.contractId}
                                        onClick={() => handleContractAction(msg, "declined")}
                                        className="h-8 rounded-lg border border-white/10 px-3 text-[11px] font-semibold text-white/75 hover:text-white hover:bg-white/10 disabled:opacity-50"
                                      >
                                        {contractActionLoadingId === contractOffer.contractId ? "Please wait..." : "Decline"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={contractActionLoadingId === contractOffer.contractId}
                                        onClick={() => handleContractAction(msg, "accepted")}
                                        className="h-8 rounded-lg px-3 text-[11px] font-semibold text-black bg-[#f5c518] hover:bg-[#e6b910] disabled:opacity-50"
                                      >
                                        {contractActionLoadingId === contractOffer.contractId ? "Please wait..." : "Accept"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {contractEvent && (
                              <div
                                className={`min-w-[240px] max-w-[360px] rounded-2xl border px-3 py-3 text-xs shadow-sm ${
                                  contractEvent.action === "accepted"
                                    ? "bg-emerald-500/12 text-emerald-200 border-emerald-500/25"
                                    : contractEvent.action === "declined"
                                      ? "bg-rose-500/12 text-rose-200 border-rose-500/25"
                                      : "bg-amber-500/12 text-amber-200 border-amber-500/25"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div
                                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
                                      contractEvent.action === "accepted"
                                        ? "bg-emerald-500/20"
                                        : contractEvent.action === "declined"
                                          ? "bg-rose-500/20"
                                          : "bg-amber-500/20"
                                    }`}
                                  >
                                    {contractEvent.action === "accepted" ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <X className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold">
                                      {contractEvent.action === "accepted"
                                        ? "Contract accepted"
                                        : contractEvent.action === "declined"
                                          ? "Contract declined"
                                          : "Contract cancelled"}
                                    </p>
                                    {contractEvent.actorName && (
                                      <p className="mt-0.5 text-[11px] opacity-80">
                                        by {contractEvent.actorName}
                                      </p>
                                    )}
                                    {contractEvent.actedAt && (
                                      <p className="mt-1 text-[10px] opacity-70">
                                        {new Date(contractEvent.actedAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {messageText && (
                              <div className="whitespace-pre-wrap break-words">
                                {renderLinkedMessageText(messageText)}
                              </div>
                            )}

                            {!hasStructuredCard && msg.createdAt && (
                              <div className={`text-[10px] ${isMe ? "text-black/45" : "text-white/35"}`}>
                                {new Date(msg.createdAt).toLocaleString()}
                              </div>
                            )}

                            {isMe && msg.status && (
                              <div className="flex justify-end mt-0.5">
                                {msg.status === "sent" && <Check className="w-[14px] h-[14px] text-black/40" />}
                                {msg.status === "delivered" && <CheckCheck className="w-[14px] h-[14px] text-black/40" />}
                                {msg.status === "seen" && <CheckCheck className="w-[14px] h-[14px] text-blue-500" />}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-white/[0.06]">
                  <AnimatePresence>
                    {attachment && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs text-white/80">
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          {attachment.type.startsWith("image/") ? (
                            <ImageIcon className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                          ) : attachment.type.startsWith("video/") ? (
                            <svg className="w-3.5 h-3.5 shrink-0 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 1.4A1 1 0 0116 10.5V13a2 2 0 01-2 2h-2.5a1 1 0 01-1-1v-2.5H9V13a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2h2v2.5H4V6z" /></svg>
                          ) : (
                            <Paperclip className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                          )}
                          <div className="truncate min-w-0">
                            <span className="truncate block">{attachment.name}</span>
                            <span className="text-[10px] text-white/40">
                              {attachment.type ? attachment.type.split("/")[1]?.toUpperCase() : "Unknown"} • {(attachment.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        </div>
                        <button onClick={() => setAttachment(null)} className="ml-3 hover:text-white/50 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPlusMenu((prev) => !prev)}
                      className="absolute left-3 z-10 w-6 h-6 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                      aria-label="Open message actions"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <AnimatePresence>
                      {showPlusMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: -8, x: 0 }} animate={{ opacity: 1, scale: 1, y: 0, x: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }} className="absolute bottom-12 left-0 w-44 bg-[#0a0a0a]/95 backdrop-blur-3xl border border-white/[0.08] rounded-2xl shadow-2xl p-2 z-[200]">
                          <button 
                            onClick={() => { setShowContractModal(true); setProfileViewerData({ id: activeConversation.partnerId, userId: activeConversation.partnerId, name: activeConversation.partnerName, image: activeConversation.partnerImage, headline: activeConversation.partnerHeadline, userType: activeConversation.partnerType }); setShowPlusMenu(false); }}
                            className="w-full h-10 rounded-xl px-3 flex items-center gap-3 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                          >
                            <div className="p-1.5 rounded-lg bg-[#f5c518]/10 text-[#f5c518]"><FileText className="w-3.5 h-3.5" /></div>
                            Send Contract
                          </button>
                          <button 
                            onClick={() => { 
                              const input = document.createElement("input");
                              input.type = "file";
                              input.accept = "*/*";
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  const maxSize = 50 * 1024 * 1024;
                                  if (file.size > maxSize) {
                                    toast.error(`File too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                                    return;
                                  }
                                  setAttachment(file);
                                  setShowPlusMenu(false);
                                }
                              };
                              input.click();
                            }}
                            className="w-full h-10 rounded-xl px-3 flex items-center gap-3 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                          >
                            <div className="p-1.5 rounded-lg bg-white/10 text-white/60"><ImageIcon className="w-3.5 h-3.5" /></div>
                            Attach Files
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !sendingMessage) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Type a message..."
                      className="flex-1 h-11 pl-11 pr-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[#f5c518]/20 focus:bg-white/[0.05] transition-all"
                    />
                    <button onClick={sendMessage} disabled={(!newMessage.trim() && !attachment) || sendingMessage} className="absolute right-1.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0 hover:scale-[1.05] active:scale-95 shadow-md shadow-[#f5c518]/20" style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}>
                      {sendingMessage ? <Loader2 className="w-3 h-3 text-black animate-spin" /> : <Send className="w-3 h-3 text-black" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFullProfileModal && profileViewerData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowFullProfileModal(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`${modalCard} max-w-3xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={modalHeader}>
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                  {profileViewerData.userType === "client" ? "Client Profile" : "Freelancer Profile"}
                </h3>
                <button
                  onClick={() => setShowFullProfileModal(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                {isLoadingProfileViewer && (
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading full profile...
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <Avatar className="w-24 h-24 rounded-[2rem] border border-[#f5c518]/20 shadow-2xl shrink-0 overflow-hidden">
                    <AvatarImage src={profileViewerData.image || ""} className="object-cover" />
                    <AvatarFallback className="w-full h-full bg-gradient-to-br from-[#f5c518]/20 to-[#c8960c]/5 flex items-center justify-center text-4xl font-black text-[#f5c518]">
                      {(profileViewerData.name || profileViewerData.displayName)?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">{profileViewerData.name || profileViewerData.displayName}</h2>
                    <p className="text-[#f5c518] font-medium text-lg mb-2">
                      {profileViewerData.headline || (profileViewerData.userType === "client" ? "Client" : "Professional Freelancer")}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-4">
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {profileViewerData.location || "Location not specified"}</span>
                      {profileViewerData.userType !== "client" && (
                        <span className="flex items-center gap-1.5 text-white/80"><span className="text-[#f5c518]">★</span> 4.9 (124 reviews)</span>
                      )}
                      {(profileViewerData.pricingText || profileViewerData.hourlyRate) && (
                        <span className="flex items-center gap-1.5 text-white/80">
                          <DollarSign className="w-4 h-4 text-[#f5c518]" /> 
                          {profileViewerData.pricingText || `${profileViewerData.hourlyRate}/hr`}
                        </span>
                      )}
                    </div>
                    {profileViewerData.companyName && (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/70">
                        <Briefcase className="w-4 h-4 text-[#f5c518]" />
                        {profileViewerData.companyName}
                        {profileViewerData.industry && <span className="text-white/35">• {profileViewerData.industry}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {(profileViewerData.bio || profileViewerData.description) && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">
                      {profileViewerData.userType === "client" ? "About / Company Overview" : "About"}
                    </h4>
                    <p className="text-white/70 leading-relaxed text-sm bg-white/[0.02] p-4 rounded-2xl border border-white/[0.04] whitespace-pre-wrap">
                      {profileViewerData.bio || profileViewerData.description}
                    </p>
                  </div>
                )}

                {profileViewerData.companyDescription && profileViewerData.companyDescription !== profileViewerData.bio && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">Company Description</h4>
                    <p className="text-white/70 leading-relaxed text-sm bg-white/[0.02] p-4 rounded-2xl border border-white/[0.04] whitespace-pre-wrap">
                      {profileViewerData.companyDescription}
                    </p>
                  </div>
                )}

                {Array.isArray(profileViewerData.skills) && profileViewerData.skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">
                      {profileViewerData.userType === "client" ? "Focus Areas" : "Expertise"}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {profileViewerData.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 rounded-full bg-white/5 text-white/80 text-sm border border-white/10 shadow-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(profileViewerData.workExperience) && profileViewerData.workExperience.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">
                      {profileViewerData.userType === "client" ? "Work / Business Details" : "Work Experience"}
                    </h4>
                    <div className="space-y-3">
                      {profileViewerData.workExperience.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                          <p className="text-sm font-semibold text-white">
                            {typeof item === "string" ? item : item?.title || item?.role || item?.company || `Experience ${idx + 1}`}
                          </p>
                          {(item?.company || item?.organization) && typeof item !== "string" && (
                            <p className="text-xs text-[#f5c518] mt-1">{item.company || item.organization}</p>
                          )}
                          {(item?.description || item?.summary) && typeof item !== "string" && (
                            <p className="text-xs text-white/55 mt-2 whitespace-pre-wrap">{item.description || item.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(profileViewerData.portfolio) && profileViewerData.portfolio.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-white/40 mb-4 uppercase tracking-[0.2em]">
                      {profileViewerData.userType === "client" ? "Portfolio / Links" : "Portfolio & Previous Work"}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {profileViewerData.portfolio.map((item: any, idx: number) => (
                        <div key={idx} className="group relative rounded-2xl overflow-hidden border border-white/[0.08] hover:border-[#f5c518]/30 transition-all bg-white/[0.02]">
                          <div className="aspect-video bg-white/[0.05] flex items-center justify-center overflow-hidden">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            ) : (
                              <ImageIcon className="w-8 h-8 text-white/15" />
                            )}
                          </div>
                          <div className="p-4">
                            <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                            {item.description && <p className="text-xs text-white/40 mt-1 line-clamp-3">{item.description}</p>}
                            {item.linkUrl && (
                              <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
                                <ExternalLink className="w-3 h-3" /> Open Link
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profileViewerData.userType !== "client" && (!Array.isArray(profileViewerData.portfolio) || profileViewerData.portfolio.length === 0) && (
                  <div className="p-8 rounded-2xl border border-dashed border-white/5 text-center">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-white/10" />
                    <p className="text-xs text-white/20">No portfolio items available yet</p>
                  </div>
                )}
              </div>

              <div className={modalFooter + " flex justify-end gap-3"}>
                <button
                  onClick={() => setShowFullProfileModal(false)}
                  className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-medium text-white/80"
                >
                  Close
                </button>
                <button
                  onClick={() => { 
                    setShowFullProfileModal(false);
                    setShowMessages(true);
                    startChatWithFreelancer(profileViewerData);
                  }}
                  className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-medium text-white/80 flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </button>
                    <button
                      onClick={() => {
                        if (profileViewerData.userType !== "client") {
                          setSelectedFreelancer(profileViewerData);
                          setFreelancerPortfolio(normalizePortfolioItems(profileViewerData.portfolio || profileViewerData.portfolioUrls || []));
                        }
                        setShowFullProfileModal(false);
                      }}
                      className="px-6 py-2.5 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-xl shadow-[#f5c518]/20 text-sm flex items-center gap-2"
                      style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}
                    >
                      <User className="w-4 h-4" />
                      {profileViewerData.userType === "client" ? "Close Profile" : "Open Portfolio"}
                    </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProjectDetailsModal && selectedDetailsProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowProjectDetailsModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} transition={{ duration: 0.25 }} className={modalCard}>
              <div className={modalHeader}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20"><Briefcase className="w-4 h-4 text-[#22c55e]" /></div>
                  <h2 className="text-base font-bold text-white">Project Details</h2>
                </div>
                <button onClick={() => setShowProjectDetailsModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white mb-2">{selectedDetailsProject.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs text-white/50">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[#f5c518] font-bold">
                      <DollarSign className="w-3.5 h-3.5" /> {selectedDetailsProject.budget}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                      <MapPin className="w-3.5 h-3.5" /> {selectedDetailsProject.projectLocation || selectedDetailsProject.location || "Remote"}
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 uppercase font-black tracking-tighter">
                      {selectedDetailsProject.category}
                    </span>
                    {getProjectDateLabel(selectedDetailsProject) && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Clock className="w-3.5 h-3.5" /> {getProjectDateLabel(selectedDetailsProject)?.label}: {getProjectDateLabel(selectedDetailsProject)?.value}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                  {selectedDetailsProject.description}
                </div>

                {selectedDetailsProject.skills && (
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(selectedDetailsProject.skills) ? selectedDetailsProject.skills : JSON.parse(selectedDetailsProject.skills || "[]")).map((s: string, i: number) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-white/60">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-white/[0.06]">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4">Client Information</h4>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                    <Avatar className="w-12 h-12 border border-white/10">
                      <AvatarImage src={selectedDetailsProject.clientImage} />
                      <AvatarFallback className="bg-white/10">{selectedDetailsProject.authorName?.[0] || "C"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedDetailsProject.authorName || "Verified Client"}</p>
                      <p className="text-xs text-white/40">{selectedDetailsProject.projectLocation || selectedDetailsProject.location || "Member since 2026"}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button 
                        onClick={() => { setShowProjectDetailsModal(false); openProfileViewer({ userId: selectedDetailsProject.userId, name: selectedDetailsProject.authorName, image: selectedDetailsProject.clientImage, userType: "client", location: selectedDetailsProject.projectLocation || selectedDetailsProject.location || null }); }}
                        className="px-4 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/10"
                      >
                        <User className="w-3.5 h-3.5" /> View Profile
                      </button>
                      <button 
                        onClick={() => { setShowProjectDetailsModal(false); startChatWithFreelancer({ userId: selectedDetailsProject.userId, displayName: selectedDetailsProject.authorName, image: selectedDetailsProject.clientImage, userType: "client", location: selectedDetailsProject.projectLocation || selectedDetailsProject.location || null }); setShowMessages(true); }}
                        className="px-4 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Message Client
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className={modalFooter}>
                <button 
                  onClick={() => {
                    setShowProjectDetailsModal(false);
                    openContractForProject(selectedDetailsProject);
                  }}
                  className="w-full h-12 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.02] transition-all shadow-xl shadow-white/5"
                >
                  Send Contract
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CLIENT ESCROW PAYMENT MODAL ── */}
      <AnimatePresence>
        {showEscrowModal && escrowContract && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={() => { setShowEscrowModal(false); setShowAddPaymentMethod(false); }}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.1] bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] shadow-2xl shadow-black/50">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur-xl px-6 py-5 border-b border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20">
                      <Shield className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Escrow Payment</h2>
                      <p className="text-[11px] text-white/40">Secure payment for contract acceptance</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowEscrowModal(false); setShowAddPaymentMethod(false); }} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors">
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Contract Summary */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-3">Contract Details</p>
                  <h3 className="text-sm font-bold text-white mb-1">{escrowContract.title}</h3>
                  {escrowContract.description && <p className="text-xs text-white/50 mb-3 line-clamp-2">{escrowContract.description}</p>}
                  {escrowContract.timeline && <p className="text-[11px] text-white/40"><span className="text-white/60 font-medium">Timeline:</span> {escrowContract.timeline}</p>}
                </div>

                {/* Payment Breakdown */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/[0.08] to-emerald-600/[0.04] border border-emerald-500/15 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60 mb-4">Payment Breakdown</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Contract Amount</span>
                      <span className="text-sm font-bold text-white">£{Number(escrowContract.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Platform Fee (10%)</span>
                      <span className="text-sm font-bold text-[#f5c518]">+ £{(Number(escrowContract.amount) * 0.1).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">Total</span>
                      <span className="text-xl font-black text-emerald-400">£{(Number(escrowContract.amount) * 1.1).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Escrow Info */}
                <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-4 flex items-start gap-3">
                  <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-300 mb-1">Secure Escrow Protection</p>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      Your payment will be held in secure escrow until the freelancer completes the work and you release the funds. The freelancer will receive £{Number(escrowContract.amount).toFixed(2)}.
                    </p>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <StripeEscrowPaymentForm
                  savedMethods={savedPaymentMethods}
                  onPaymentMethodSelect={setSelectedPaymentMethod}
                  selectedPaymentMethod={selectedPaymentMethod}
                  amount={Number(escrowContract.amount)}
                  contractId={escrowContract.contractId}
                  freelancerId={activeConversation?.partnerId || ""}
                  onSuccess={() => {
                    setShowEscrowModal(false);
                    setEscrowContract(null);
                    setEscrowMsg(null);
                    if (activeConversation) {
                      fetchMessagesForConversation(activeConversation.partnerId, { silent: true });
                    }
                  }}
                  onCancel={() => {
                    setShowEscrowModal(false);
                    setShowAddPaymentMethod(false);
                  }}
                />

                {/* Cancellation Policy Warning */}
                <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-300">Cancellation Policy</p>
                  </div>
                  <div className="text-[11px] text-white/50 leading-relaxed space-y-1.5 pl-6">
                    <p>• You can cancel within <strong className="text-white/70">12 hours</strong> for a full refund with no penalties.</p>
                    <p>• After 12 hours: The <strong className="text-amber-300">10% platform fee</strong> will be charged and kept.</p>
                    <p>• <strong className="text-red-400">2nd late cancellation:</strong> Double platform fee (20% of contract amount) charged + <strong className="text-red-400">permanent ban</strong> from the community.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FREELANCER ACCEPT CONTRACT INFO MODAL ── */}
      <AnimatePresence>
        {showFreelancerAcceptModal && escrowContract && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={() => setShowFreelancerAcceptModal(false)}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.3 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/[0.1] bg-gradient-to-b from-[#0f0f0f] to-[#0a0a0a] shadow-2xl shadow-black/50">
              {/* Header */}
              <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur-xl px-6 py-5 border-b border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
                      <FileSignature className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Accept Contract</h2>
                      <p className="text-[11px] text-white/40">Review contract details before accepting</p>
                    </div>
                  </div>
                  <button onClick={() => setShowFreelancerAcceptModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors">
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Contract Summary */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-3">Contract Details</p>
                  <h3 className="text-sm font-bold text-white mb-1">{escrowContract.title}</h3>
                  {escrowContract.description && <p className="text-xs text-white/50 mb-3 line-clamp-3">{escrowContract.description}</p>}
                  {escrowContract.timeline && <p className="text-[11px] text-white/40 mb-1"><span className="text-white/60 font-medium">Timeline:</span> {escrowContract.timeline}</p>}
                  {escrowContract.milestones && <p className="text-[11px] text-white/40"><span className="text-white/60 font-medium">Milestones:</span> {escrowContract.milestones}</p>}
                </div>

                {/* Payment Info for Freelancer */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-indigo-500/[0.04] border border-blue-500/15 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400/60 mb-4">Your Earnings</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">You will receive</span>
                    <span className="text-2xl font-black text-emerald-400">£{Number(escrowContract.amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Escrow Info */}
                <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-4 flex items-start gap-3">
                  <Shield className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-300 mb-1">Escrow Protection</p>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      The client&apos;s payment will be held in secure escrow until you complete the work. Once the client releases the funds, £{Number(escrowContract.amount).toFixed(2)} will be added to your balance.
                    </p>
                  </div>
                </div>

                {/* Cancellation Policy Warning */}
                <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-300">Cancellation Policy</p>
                  </div>
                  <div className="text-[11px] text-white/50 leading-relaxed space-y-1.5 pl-6">
                    <p>• You can cancel within <strong className="text-white/70">12 hours</strong> with no penalties.</p>
                    <p>• After 12 hours: The <strong className="text-amber-300">10% platform fee</strong> will be deducted from your next contract earnings.</p>
                    <p>• <strong className="text-red-400">2nd late cancellation:</strong> You will be <strong className="text-red-400">permanently banned</strong> from the community.</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFreelancerAcceptModal(false)}
                    className="flex-1 h-12 rounded-xl border border-white/[0.1] text-white/60 text-sm font-semibold hover:bg-white/[0.05] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFreelancerAcceptContract}
                    disabled={escrowProcessing}
                    className="flex-[2] h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-sm hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    {escrowProcessing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Accepting...</>
                    ) : (
                      <><Check className="w-4 h-4" /> Accept Contract</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
