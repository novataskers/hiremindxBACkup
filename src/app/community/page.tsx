"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Clock, 
  Briefcase, 
  Users, 
  Zap, 
  MessageCircle, 
  ArrowRight,
  ChevronRight,
  Code,
  Palette,
  Edit3,
  Megaphone,
  BarChart3,
  Video,
  Globe,
  LayoutGrid,
  List as ListIcon,
  ArrowLeft,
  User,
  DollarSign,
  Image as ImageIcon,
  Link as LinkIcon,
  X,
  Plus,
  Upload,
  Loader2,
    Tag,
    Package,
    Check,
    FileText,
    Send,
    Layers3,
    Phone,
    Paperclip,
    ExternalLink,
    CheckCheck,
    Target
  } from "lucide-react";
import type { GlobeHandle, GlobeMarker } from "@/components/InteractiveGlobe";

const InteractiveGlobe = dynamic(() => import("@/components/InteractiveGlobe"), { ssr: false });
const GlobeAIChat = dynamic(() => import("@/components/GlobeAIChat"), { ssr: false });
import { Button } from "@/components/ui/button";
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

const CATEGORIES = [
  { id: "all", name: "All Categories", icon: LayoutGrid },
  { id: "tech", name: "Technology & Programming", icon: Code },
  { id: "design", name: "Design & Creative", icon: Palette },
  { id: "writing", name: "Writing & Translation", icon: Edit3 },
  { id: "marketing", name: "Digital Marketing", icon: Megaphone },
  { id: "video", name: "Video & Photo", icon: Video },
  { id: "business", name: "Business & Support", icon: BarChart3 },
];

const OFFER_CATEGORIES = [
  { value: "tech", label: "Technology & Programming" },
  { value: "design", label: "Design & Creative" },
  { value: "writing", label: "Writing & Translation" },
  { value: "marketing", label: "Digital Marketing" },
  { value: "video", label: "Video & Photo" },
  { value: "business", label: "Business & Support" },
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
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [creatingProject, setCreatingProject] = useState(false);
    const [newProject, setNewProject] = useState({
      title: "", description: "", category: "", budget: "", deadline: "", skills: "",
    });
        const [dbProjects, setDbProjects] = useState<any[]>([]);
        const [showProposalModal, setShowProposalModal] = useState(false);
        const [selectedProject, setSelectedProject] = useState<any>(null);
        const [submittingProposal, setSubmittingProposal] = useState(false);
        const [proposalForm, setProposalForm] = useState({ coverLetter: "", bidAmount: "", deliveryDays: "" });
        const [myProposalProjectIds, setMyProposalProjectIds] = useState<number[]>([]);
        const [showSuggestions, setShowSuggestions] = useState(false);
      const [suggestions, setSuggestions] = useState<{ type: string; label: string; value: string }[]>([]);
      const searchContainerRef = useRef<HTMLDivElement>(null);
      const [showMessages, setShowMessages] = useState(false);
      const [conversations, setConversations] = useState<any[]>([]);
      const [loadingConversations, setLoadingConversations] = useState(false);
      const [activeConversation, setActiveConversation] = useState<any>(null);
      const [chatMessages, setChatMessages] = useState<any[]>([]);
      const [loadingChat, setLoadingChat] = useState(false);
      const [newMessage, setNewMessage] = useState("");
      const [attachment, setAttachment] = useState<File | null>(null);
      const [sendingMessage, setSendingMessage] = useState(false);
      const [unreadCount, setUnreadCount] = useState(0);
       const chatEndRef = useRef<HTMLDivElement>(null);
       const chatPollRef = useRef<NodeJS.Timeout | null>(null);

       const [showContractModal, setShowContractModal] = useState(false);
       const [submittingContract, setSubmittingContract] = useState(false);
       const [contractForm, setContractForm] = useState({ title: "", description: "", amount: "", timeline: "", milestones: "" });

  // Globe state
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

  // Request geolocation on mount and place golden marker
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
      () => {} // silently ignore denied
    );
  }, [hasProfile]);

  useEffect(() => {
    const checkProfile = async () => {
      // Force profile access for dev/localhost or if we want it public
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
        // If not logged in, we can still show a read-only or limited community view
        setHasProfile(true); // Allow them to see the globe and chat
        setIsCheckingProfile(false);
        setUserType("client"); // Default to client for public view
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
          // Even if profile is not complete, let them see the community
          setHasProfile(true);
          setShowOnboarding(true); 
        }
      } catch (error) {
        console.error("Error checking profile:", error);
        setHasProfile(true); // Fallback to accessible
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
          .then(r => r.json())
          .then(data => { if (data.projects) setDbProjects(data.projects); })
          .catch(console.error);
      }
      if (userType === "client" && offers.length === 0) {
        fetch("/api/community/offers")
          .then(r => r.json())
          .then(data => { if (data.offers) setOffers(data.offers); })
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
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }

        const results: { type: string; label: string; value: string }[] = [];

        CATEGORIES.filter(c => c.id !== "all").forEach(cat => {
          if (cat.name.toLowerCase().includes(q)) {
            results.push({ type: "Category", label: cat.name, value: cat.name });
          }
        });

        if (userType === "freelancer") {
          [...dbProjects, ...PROJECTS].forEach(p => {
            if (p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)) {
              if (!results.find(r => r.label === p.title)) {
                results.push({ type: "Project", label: p.title, value: p.title });
              }
            }
          });
        } else {
          offers.forEach((o: any) => {
            if (o.title?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)) {
              if (!results.find(r => r.label === o.title)) {
                results.push({ type: "Offer", label: o.title, value: o.title });
              }
            }
            if (Array.isArray(o.tags)) {
              o.tags.forEach((tag: string) => {
                if (tag.toLowerCase().includes(q) && !results.find(r => r.label === tag && r.type === "Tag")) {
                  results.push({ type: "Tag", label: tag, value: tag });
                }
              });
            }
          });
        }

        setSuggestions(results.slice(0, 8));
        setShowSuggestions(results.length > 0);
      }, [searchQuery, userType, dbProjects, offers]);

      const handleSelectSuggestion = (suggestion: { type: string; label: string; value: string }) => {
        setSearchQuery(suggestion.value);
        setShowSuggestions(false);
        setTimeout(() => {
          const q = suggestion.value.toLowerCase();
          if (userType === "freelancer") {
            const allProjects = [...dbProjects, ...PROJECTS];
            const filtered = allProjects.filter(p =>
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
        const filtered = allProjects.filter(p =>
          p.title.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
        setSearchResults(filtered);
        setActiveTab("projects");
      } else {
        if (offers.length === 0) {
          fetch("/api/community/offers")
            .then(r => r.json())
            .then(data => {
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

    useEffect(() => {
      if (!hasProfile || userType !== "freelancer" || !session?.user?.id) return;
      fetch("/api/community/proposals?userId=" + session.user.id)
        .then(r => r.json())
        .then(data => {
          if (data.proposals) {
            setMyProposalProjectIds(data.proposals.map((p: any) => p.projectId));
          }
        })
        .catch(() => {});
    }, [hasProfile, userType, session?.user?.id]);

    const handleSendProposal = async () => {
      if (!selectedProject || !proposalForm.coverLetter || !proposalForm.bidAmount || !proposalForm.deliveryDays) {
        toast.error("Please fill in all fields");
        return;
      }
      setSubmittingProposal(true);
      try {
        const res = await fetch("/api/community/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProject.id,
            coverLetter: proposalForm.coverLetter,
            bidAmount: proposalForm.bidAmount,
            deliveryDays: proposalForm.deliveryDays,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "Failed to send proposal");
          return;
        }
          toast.success("Proposal sent successfully!");
          try {
            await fetch("/api/community/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                receiverId: selectedProject.userId,
                message: `Hi! I've submitted a proposal for your project "${selectedProject.title}". My bid: ${proposalForm.bidAmount} with ${proposalForm.deliveryDays}-day delivery.\n\n${proposalForm.coverLetter.slice(0, 200)}${proposalForm.coverLetter.length > 200 ? "..." : ""}`,
                projectId: selectedProject.id,
                proposalId: data.proposal?.id,
              }),
            });
          } catch {}
          setShowProposalModal(false);
          setProposalForm({ coverLetter: "", bidAmount: "", deliveryDays: "" });
          setSelectedProject(null);
          setMyProposalProjectIds(prev => [...prev, selectedProject.id]);
          const projRes = await fetch("/api/community/projects");
          const projData = await projRes.json();
          if (projData.projects) setDbProjects(projData.projects);
      } catch {
        toast.error("Failed to send proposal");
      } finally {
        setSubmittingProposal(false);
      }
    };

    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        const res = await fetch("/api/community/messages?conversations=true");
        const data = await res.json();
        if (data.conversations) {
          setConversations(data.conversations);
          setUnreadCount(data.conversations.reduce((sum: number, c: any) => sum + c.unreadCount, 0));
        }
      } catch {} finally { setLoadingConversations(false); }
    };

    const openConversation = async (conv: any) => {
      setActiveConversation(conv);
      setLoadingChat(true);
      try {
        const res = await fetch(`/api/community/messages?withUser=${conv.partnerId}`);
        const data = await res.json();
        if (data.messages) setChatMessages(data.messages);
        await fetch("/api/community/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withUser: conv.partnerId }) });
        setConversations(prev => prev.map(c => c.partnerId === conv.partnerId ? { ...c, unreadCount: 0 } : c));
        setUnreadCount(prev => Math.max(0, prev - (conv.unreadCount || 0)));
      } catch {} finally { setLoadingChat(false); }
    };

    const sendMessage = async () => {
      if ((!newMessage.trim() && !attachment) || !activeConversation || !session?.user?.id) {
        if (!session?.user?.id) toast.error("Please log in to send messages");
        return;
      }

      const messageContent = newMessage.trim();
      setSendingMessage(true);
      
      try {
        const res = await fetch("/api/community/messages", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            receiverId: activeConversation.partnerId, 
            message: messageContent,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("Community sendMessage failed", {
            status: res.status,
            statusText: res.statusText,
            response: data,
            receiverId: activeConversation.partnerId,
          });

          // Handle demo profiles specifically
          if (res.status === 400 && data?.error?.includes("demo profile")) {
             const mockMsg = {
                id: Date.now(),
                senderId: session?.user?.id,
                receiverId: activeConversation.partnerId,
                message: messageContent,
                createdAt: new Date().toISOString(),
                isRead: true,
             };
             setChatMessages(prev => [...prev, { ...mockMsg, status: 'sent' }]);
             
             const previewText = attachment ? `Sent an attachment` : messageContent;
             setConversations(prev => {
               const exists = prev.find(c => c.partnerId === activeConversation.partnerId);
               if (exists) {
                 return prev.map(c => c.partnerId === activeConversation.partnerId ? { ...c, lastMessage: previewText, lastMessageAt: new Date().toISOString() } : c);
               }
               return [{...activeConversation, lastMessage: previewText, lastMessageAt: new Date().toISOString()}, ...prev];
             });
             
             setNewMessage("");
             setAttachment(null);
             
             // Simulate reply
             setTimeout(() => {
                const replyMsg = {
                  id: Date.now() + 1,
                  senderId: activeConversation.partnerId,
                  receiverId: session?.user?.id,
                  message: "Thanks for reaching out! This is an automated reply from a demo profile.",
                  createdAt: new Date().toISOString(),
                  isRead: false,
                };
                // Only add reply to chat if this conversation is still active
                setChatMessages(prev => {
                  // This relies on the closure state, but it's okay for a quick mock.
                  return [...prev, { ...replyMsg, status: 'delivered' }];
                });
                setConversations(prev => {
                  return prev.map(c => c.partnerId === activeConversation.partnerId ? { ...c, lastMessage: replyMsg.message, lastMessageAt: replyMsg.createdAt, unreadCount: (c.unreadCount || 0) + 1 } : c);
                });
             }, 1500);

             setSendingMessage(false);
             return;
          }

          if (res.status === 401) throw new Error("UNAUTHORIZED");
          if (res.status === 400) {
            const err: any = new Error("BAD_REQUEST");
            err.details = data?.error || data?.details || "";
            throw err;
          }
          const err: any = new Error("FAILED");
          err.details = data?.details || data?.error || "";
          throw err;
        }
        const sentMsg = data.message;
        
        if (sentMsg) {
          setChatMessages(prev => [...prev, { ...sentMsg, status: 'sent' }]);
          
          const previewText = attachment ? `Sent an attachment` : messageContent;
          setConversations(prev => {
            const exists = prev.find(c => c.partnerId === activeConversation.partnerId);
            if (exists) {
              return prev.map(c => c.partnerId === activeConversation.partnerId ? { ...c, lastMessage: previewText, lastMessageAt: new Date().toISOString() } : c);
            }
            return [activeConversation, ...prev];
          });
        }
        
        setNewMessage("");
        setAttachment(null);
        
      } catch (err) {
        const code = err instanceof Error ? err.message : "FAILED";
        if (code === "UNAUTHORIZED") toast.error("Please log in again to send messages.");
        else if (code === "BAD_REQUEST") {
          const errDetail = (err as any)?.details;
          toast.error(errDetail ? errDetail : "Message could not be sent (missing/invalid data).");
        }
        else {
          const errDetail = (err as any)?.details || "";
          toast.error(errDetail ? `Failed to send: ${errDetail}` : "Failed to send message. Please try again.");
        }
        console.error("sendMessage error:", err);
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
        partnerId: partnerId,
        partnerName: freelancer.displayName || freelancer.name || "Freelancer",
        partnerImage: freelancer.image || freelancer.userImage || null,
        partnerType: "freelancer",
        partnerHeadline: freelancer.headline || null,
        lastMessage: "",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };
      
      setConversations(prev => {
        const existing = prev.find(c => c.partnerId === partnerId);
        if (!existing) return [conv, ...prev];
        return prev;
      });
      openConversation(conv);
    };

    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    useEffect(() => {
      if (showMessages && activeConversation) {
        chatPollRef.current = setInterval(async () => {
          try {
            const res = await fetch(`/api/community/messages?withUser=${activeConversation.partnerId}`);
            const data = await res.json();
            if (data.messages) setChatMessages(data.messages);
          } catch {}
        }, 5000);
        return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
      }
      return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
    }, [showMessages, activeConversation]);

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
          tags: newOffer.tags ? newOffer.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      if (res.ok) {
          const data = await res.json();
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
        const res = await fetch("/api/community/messages", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiverId: partnerId,
            message: `[CONTRACT OFFER]\nTitle: ${contractForm.title}\nAmount: $${contractForm.amount}\n${contractForm.timeline ? `Timeline: ${contractForm.timeline}\n` : ""}${contractForm.milestones ? `Milestones: ${contractForm.milestones}\n` : ""}\nDescription:\n${contractForm.description}`,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok || (res.status === 400 && data?.error?.includes("demo profile"))) {
          toast.success("Contract offer sent!");
          setShowContractModal(false);
          setContractForm({ title: "", description: "", amount: "", timeline: "", milestones: "" });
          // Open chat automatically
          startChatWithFreelancer(profileViewerData);
        } else {
          toast.error(data?.error || data?.details || "Failed to send contract");
        }
      } catch {
        toast.error("Error sending contract");
      } finally {
        setSubmittingContract(false);
      }
    };

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
          skills: newProject.skills ? newProject.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
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
        setNewProject({ title: "", description: "", category: "", budget: "", deadline: "", skills: "" });
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
    setSelectedFreelancer(freelancer);
    try {
      const res = await fetch(`/api/community/portfolio?userId=${freelancer.userId}`);
      const data = await res.json();
      setFreelancerPortfolio(data.items || []);
    } catch {
      setFreelancerPortfolio(freelancer.portfolio || []);
    }
  };

  const filteredProjects = dbProjects.filter((p) => {
    if (freelancerCategoryFilter !== "all" && p.category !== freelancerCategoryFilter) return false;
    if (freelancerLocationFilter) {
      const search = freelancerLocationFilter.toLowerCase();
      const matchesSearch = p.title.toLowerCase().includes(search) || (p.description || "").toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    return true;
  });

  useEffect(() => {
    if (userType === "freelancer" && userLocation) {
      const newMarkers: GlobeMarker[] = [{
        id: "__my_location__",
        lat: userLocation.lat,
        lng: userLocation.lng,
        label: "You",
        type: "user",
        color: "#f5c518",
      }];
      
      filteredProjects.forEach((p, idx) => {
        // Pseudo-random cluster based on user location (radius ~2 degrees ≈ 220km)
        const prngLng = Math.sin(p.id * 1234.5) * 5; 
        const prngLat = Math.cos(p.id * 5678.9) * 5;
        const lat = userLocation.lat + prngLat;
        const lng = userLocation.lng + prngLng;
        newMarkers.push({
          id: `proj_${p.id}`,
          lat,
          lng,
          label: p.title,
          type: "project",
          color: "#22c55e", // Green for jobs
        });
      });
      setGlobeMarkers(newMarkers);
    }
  }, [userType, userLocation, filteredProjects.length, freelancerLocationFilter, freelancerCategoryFilter]);

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

  /* ─── shared input style ─── */
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

      {/* Top navigation */}
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
        <button onClick={() => router.push('/profile')} className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          {session?.user?.image ? (
            <Avatar className="w-7 h-7"><AvatarImage src={session.user.image} /><AvatarFallback className="text-xs bg-white/10">{session.user.name?.[0] || 'U'}</AvatarFallback></Avatar>
          ) : (<User className="w-4 h-4 text-white/60" />)}
        </button>
        <button onClick={() => setShowMessages(true)} className="relative w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white/60" />
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
        <button onClick={() => router.push('/')} className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white/60" />
        </button>
      </div>

       {/* ── MAIN 2-COLUMN LAYOUT: left=AI chat, center/right=globe ── */}
       <div className="fixed inset-0 pt-[72px] flex overflow-hidden">

         {/* LEFT: Dynamic Sidebar (AI Chat for Clients, Job Feed for Freelancers) */}
         <div className="w-80 shrink-0 flex flex-col m-4 mr-0 rounded-[2.5rem] border border-white/[0.08] bg-[#0a0a0a]/70 backdrop-blur-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] relative group transition-all duration-500 hover:border-white/20">
           {/* Glossy highlight line at the top */}
           <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
           
           {userType === "client" || userType === null ? (
             <GlobeAIChat
               globeRef={globeRef}
               onWorkersFound={(workers) => setGlobeWorkers(workers)}
               onMarkerAdd={(marker) => setGlobeMarkers((prev) => [...prev.filter(m => m.id !== marker.id), marker])}
               onMarkersClear={() => {
                 const myLoc = globeMarkers.find(m => m.id === "__my_location__");
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
                       placeholder="Location (e.g. Remote, City)" 
                       value={freelancerLocationFilter}
                       onChange={(e) => setFreelancerLocationFilter(e.target.value)}
                       className="pl-9 h-10 bg-white/[0.03] border border-white/[0.06] text-xs focus:ring-white/10"
                     />
                   </div>
                   <div className="relative">
                     <ListIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                     <select 
                       value={freelancerCategoryFilter}
                       onChange={(e) => setFreelancerCategoryFilter(e.target.value)}
                       className="w-full pl-9 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs focus:ring-white/10 text-white appearance-none outline-none"
                     >
                       {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                   filteredProjects.map((p) => (
                     <div key={p.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-all cursor-pointer group" onClick={() => {
                        const marker = globeMarkers.find(mx => mx.id === `proj_${p.id}`);
                        if (marker) globeRef.current?.flyTo(marker.lat, marker.lng, 2.2);
                     }}>
                       <div className="flex justify-between items-start mb-2">
                         <h3 className="font-bold text-sm text-white/90 line-clamp-2">{p.title}</h3>
                         <Badge className="bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20 shrink-0 text-[10px] uppercase font-bold px-2 py-0">NEW</Badge>
                       </div>
                       <p className="text-xs text-white/40 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                       <div className="flex items-center gap-3 text-[10px] text-white/50 mb-4 bg-white/[0.03] p-2 rounded-lg border border-white/[0.04]">
                         <span className="flex items-center gap-1 font-semibold text-white/80"><DollarSign className="w-3 h-3 text-[#f5c518]"/> {p.budget}</span>
                         {p.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-white/40"/> {p.deadline}</span>}
                       </div>
                       <div className="flex gap-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); startChatWithFreelancer({ userId: p.userId || 'client1', displayName: p.authorName || 'Client' }); setShowMessages(true); }}
                           className="flex-1 h-8 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5"
                         >
                           <MessageCircle className="w-3 h-3" /> Message
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setProfileViewerData({ userId: p.userId || 'client1', name: p.authorName || 'Client' }); setShowFullProfileModal(true); }}
                           className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all"
                         >
                           <User className="w-3 h-3" />
                         </button>
                       </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
           )}
         </div>

         {/* CENTER: Globe — fills remaining space */}
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

             {/* Workers Found — floating bar, only visible when workers exist */}
             <AnimatePresence>
               {globeWorkers.length > 0 && (
                 <motion.div
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 20 }}
                   className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 flex-wrap justify-center"
                   style={{ maxWidth: "calc(100% - 48px)" }}
                 >
                   {/* Worker chips - Restyled */}
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
                         const myLoc = globeMarkers.find(m => m.id === "__my_location__");
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

             {/* Selected worker card — floating */}
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
                         setProfileViewerData(selectedGlobeWorker);
                         setShowContractModal(true);
                       }}
                       className="w-full h-8 rounded-xl text-[11px] font-bold text-black transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 shadow-md shadow-[#f5c518]/20"
                       style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}
                     >
                       <Check className="w-3 h-3 black" /> Hire Now
                     </button>
                     <button
                       onClick={() => {
                         setProfileViewerData(selectedGlobeWorker);
                         setShowFullProfileModal(true);
                       }}
                       className="w-full h-8 rounded-xl text-[11px] font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                     >
                       <User className="w-3 h-3" /> Profile
                     </button>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>

             {/* Selected project card — floating */}
             <AnimatePresence>
               {selectedGlobeProject && (
                 <motion.div
                   key={"proj_"+selectedGlobeProject.id}
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
                   
                   <div className="flex flex-wrap gap-2 text-[10px] text-white/60 mb-4 bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                     <span className="flex items-center gap-1 bg-white/[0.05] px-2 py-1 rounded-md"><DollarSign className="w-3 h-3 text-[#f5c518]"/> {selectedGlobeProject.budget}</span>
                     {selectedGlobeProject.deadline && <span className="flex items-center gap-1 bg-white/[0.05] px-2 py-1 rounded-md"><Clock className="w-3 h-3"/> {selectedGlobeProject.deadline}</span>}
                   </div>

                   <div className="flex flex-col gap-2">
                     <button
                       onClick={() => { startChatWithFreelancer({ userId: selectedGlobeProject.userId || 'client1', displayName: selectedGlobeProject.authorName || 'Client' }); setShowMessages(true); }}
                       className="w-full h-8 rounded-xl text-[11px] font-bold text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                     >
                       <MessageCircle className="w-3 h-3" /> Message Client
                     </button>
                     <button
                       onClick={() => { 
                          setProfileViewerData({ userId: selectedGlobeProject.userId || 'client1', name: selectedGlobeProject.authorName || 'Client' });
                          setShowFullProfileModal(true);
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

      {/* ── HIDDEN: legacy content panels (modals still work) ── */}
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
                {/* ── OFFERS ── */}
                {activeTab === "offers" && loadingOffers && (
                  <div className="col-span-full text-center py-16">
                    <Loader2 className="w-7 h-7 mx-auto mb-3 animate-spin text-white/20" />
                    <p className="text-sm text-white/30">Loading offers...</p>
                  </div>
                )}

                {activeTab === "offers" && !loadingOffers && (searchResults !== null && userType === "client" ? searchResults : offers).filter(o => activeCategory === 'all' || o.category === activeCategory).length === 0 && (
                  <div className="col-span-full text-center py-16">
                    <Package className="w-10 h-10 mx-auto mb-3 text-white/10" />
                    <p className="text-base font-medium text-white/30 mb-1">{searchResults !== null ? "No offers match your search" : "No offers available yet"}</p>
                    {searchResults !== null && (
                      <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-xs text-white/50 hover:text-white mt-2">Clear Search</button>
                    )}
                  </div>
                )}

                {activeTab === "offers" && !loadingOffers && (searchResults !== null && userType === "client" ? searchResults : offers).filter(o => activeCategory === 'all' || o.category === activeCategory).map((offer: any) => (
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
                        <span className="flex items-center gap-1.5 text-xs text-white/30">
                          <Clock className="w-3 h-3" />
                          {offer.deliveryDays} day{offer.deliveryDays !== 1 ? 's' : ''} delivery
                        </span>
                        <button className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors font-medium">
                          View Offer <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* ── MY OFFERS ── */}
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
                      <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[10px] font-medium ${offer.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-white/10 text-white/50 border border-white/[0.08]'}`}>
                        {offer.status === 'active' ? 'Active' : offer.status || 'Active'}
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
                        <span className="flex items-center gap-1.5 text-xs text-white/30">
                          <Clock className="w-3 h-3" />
                          {offer.deliveryDays} day{offer.deliveryDays !== 1 ? 's' : ''} delivery
                        </span>
                        <button
                          className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/community/offers?id=${offer.id}`, { method: "DELETE" });
                              if (res.ok) {
                                setMyOffers(prev => prev.filter(o => o.id !== offer.id));
                                setOffers(prev => prev.filter(o => o.id !== offer.id));
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

                {/* ── PROJECTS ── */}
                {activeTab === "projects" && (searchResults !== null ? searchResults : [...dbProjects, ...PROJECTS].filter(p => activeCategory === 'all' || p.category === activeCategory)).length === 0 && (
                  <div className="col-span-full text-center py-16">
                    <Briefcase className="w-10 h-10 mx-auto mb-3 text-white/10" />
                    <p className="text-base font-medium text-white/30">{searchResults !== null ? "No projects match your search" : "No projects yet"}</p>
                    {searchResults !== null && (
                      <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="text-xs text-white/50 hover:text-white mt-2">Clear Search</button>
                    )}
                  </div>
                )}

                {activeTab === "projects" && (searchResults !== null ? searchResults : [...dbProjects, ...PROJECTS].filter(p => activeCategory === 'all' || p.category === activeCategory)).map((project: any) => (
                  <div key={project.id} className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium">{project.budget}</span>
                      <span className="text-[10px] text-white/25 font-medium uppercase tracking-widest">{project.posted}</span>
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
                          <Users className="w-3.5 h-3.5" />
                          {project.proposals || 0} proposals
                        </span>
                        {project.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {project.deadline}
                          </span>
                        )}
                      </div>
                      {myProposalProjectIds.includes(project.id) ? (
                        <button disabled className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium cursor-default">
                          <Check className="w-3 h-3" /> Proposal Sent
                        </button>
                      ) : (
                        <button
                          className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all"
                          onClick={() => {
                            setSelectedProject(project);
                            setProposalForm({ coverLetter: "", bidAmount: "", deliveryDays: "" });
                            setShowProposalModal(true);
                          }}
                        >
                          Send Proposal
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* ── FREELANCERS ── */}
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
                          <div key={idx} className={`relative overflow-hidden ${freelancer.portfolio.length === 1 ? 'col-span-3' : idx === 0 && freelancer.portfolio.length === 2 ? 'col-span-2' : ''}`}>
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
                          {userType === 'client' && (
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

                {/* ── MY POSTS ── */}
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

                {activeTab === "myPosts" && !loadingMyPosts && myPosts.map((project: any) => (
                  <div key={project.id} className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium">{project.budget}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${project.status === 'open' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.05] text-white/30 border border-white/[0.06]'}`}>
                        {project.status === 'open' ? 'Open' : project.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{project.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed mb-4 line-clamp-2">{project.description}</p>
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
                              setMyPosts(prev => prev.filter(p => p.id !== project.id));
                              toast.success("Project closed");
                            }
                          } catch { toast.error("Failed to close project"); }
                        }}
                      >
                        <X className="w-3 h-3" /> Close
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
              </AnimatePresence>
        </div>

      {/* ── CREATE OFFER MODAL ── */}
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
                      {OFFER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
                    <div onClick={() => offerImageRef.current?.click()} className="border border-dashed border-white/[0.08] rounded-xl p-6 text-center cursor-pointer hover:border-white/20 hover:bg-white/[0.03] transition-all">
                      <Upload className="w-5 h-5 mx-auto mb-1 text-white/20" />
                      <p className="text-xs text-white/30">Click to upload (max 5MB)</p>
                    </div>
                  )}
                  <input ref={offerImageRef} type="file" accept="image/*" onChange={handleOfferImageUpload} className="hidden" />
                </div>
              </div>
              <div className={modalFooter}>
                <button onClick={handleCreateOffer} disabled={!newOffer.title || !newOffer.category || !newOffer.price || !newOffer.deliveryDays || creatingOffer} className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-40">
                  {creatingOffer ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Creating...</span> : "Publish Offer"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CREATE PROJECT MODAL ── */}
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
                      {OFFER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
                    <Label className="text-xs text-white/40 mb-1.5 block">Required Skills</Label>
                    <Input placeholder="e.g., React, Python, AI" value={newProject.skills} onChange={(e) => setNewProject({ ...newProject, skills: e.target.value })} className={inp} />
                  </div>
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

      {/* ── SEND PROPOSAL MODAL ── */}
      <AnimatePresence>
        {showProposalModal && selectedProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowProposalModal(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] bg-[#0a0a0a] border border-white/[0.08]">
              <div className={modalHeader}>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2"><Send className="w-4 h-4 text-white/50" /> Send Proposal</h2>
                </div>
                <button onClick={() => setShowProposalModal(false)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
              </div>
              <div className="px-6 pt-4 pb-2">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <h3 className="font-semibold text-sm text-white mb-1">{selectedProject.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-white/30">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{selectedProject.budget}</span>
                    {selectedProject.deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedProject.deadline}</span>}
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <Label className="text-xs text-white/40 mb-1.5 block">Cover Letter *</Label>
                  <p className="text-[10px] text-white/25 mb-2">Introduce yourself and explain why you're the best fit.</p>
                  <textarea placeholder="Hi, I'd love to work on this project. Here's why I'm the right freelancer..." value={proposalForm.coverLetter} onChange={(e) => setProposalForm({ ...proposalForm, coverLetter: e.target.value })} rows={6} className={textarea} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Your Bid *</Label>
                    <Input placeholder="e.g., $750" value={proposalForm.bidAmount} onChange={(e) => setProposalForm({ ...proposalForm, bidAmount: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <Label className="text-xs text-white/40 mb-1.5 block">Delivery (days) *</Label>
                    <Input type="number" placeholder="e.g., 14" value={proposalForm.deliveryDays} onChange={(e) => setProposalForm({ ...proposalForm, deliveryDays: e.target.value })} className={inp} />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/30 space-y-1">
                  <p className="font-semibold text-white/50 mb-1.5">Tips for a winning proposal:</p>
                  <p>· Address the client's specific needs mentioned in the project</p>
                  <p>· Highlight relevant experience and portfolio work</p>
                  <p>· Be realistic with your timeline and budget</p>
                </div>
              </div>
              <div className={modalFooter}>
                <button onClick={handleSendProposal} disabled={!proposalForm.coverLetter || !proposalForm.bidAmount || !proposalForm.deliveryDays || submittingProposal} className="w-full h-11 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-40">
                  {submittingProposal ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</span> : "Send Proposal"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FREELANCER PORTFOLIO MODAL ── */}
      {/* ── CONTRACT MODAL ── */}
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
                  {userType === 'client' && (
                    <button onClick={() => { setSelectedFreelancer(null); startChatWithFreelancer(selectedFreelancer); }} className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-white/10 border border-white/[0.08] text-white text-xs font-medium hover:bg-white/15 transition-all">
                      <MessageCircle className="w-3.5 h-3.5" /> Message
                    </button>
                  )}
                  <button onClick={() => setSelectedFreelancer(null)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Info */}
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

      {/* ── MESSAGES PANEL ── */}
      <AnimatePresence>
        {showMessages && (
          <motion.div initial={{ opacity: 0, x: 400 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 400 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 z-[200] w-full max-w-sm bg-[#080808] border-l border-white/[0.08] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
              {activeConversation ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveConversation(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"><ArrowLeft className="w-4 h-4 text-white/50" /></button>
                  <Avatar className="w-9 h-9 border border-white/10 shrink-0 shadow-xl shadow-black">
                    <AvatarImage src={activeConversation.partnerImage || ""} />
                    <AvatarFallback className="text-sm font-bold bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/30">
                      {activeConversation.partnerName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{activeConversation.partnerName}</p>
                    <p className="text-[10px] text-[#f5c518] truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> Online
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-white">Messages</p>
                  {unreadCount > 0 && <p className="text-[10px] text-white/40">{unreadCount} unread</p>}
                </div>
              )}
              <button onClick={() => { setShowMessages(false); setActiveConversation(null); }} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4 text-white/50" /></button>
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
                    <button key={idx} onClick={() => openConversation(conv)} className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04]">
                      <Avatar className="w-9 h-9 shrink-0 border border-white/10">
                        <AvatarImage src={conv.partnerImage || ""} />
                        <AvatarFallback className="text-xs bg-white/10">{conv.partnerName?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white/80 truncate">{conv.partnerName}</p>
                          {conv.unreadCount > 0 && <span className="w-4 h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center shrink-0">{conv.unreadCount}</span>}
                        </div>
                        <p className="text-xs text-white/30 truncate">{conv.lastMessage || "No messages yet"}</p>
                      </div>
                    </button>
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
                      return (
                      <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] flex flex-col gap-1 px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-white text-black' : 'bg-white/[0.08] text-white/80 border border-white/[0.06]'}`}>
                          
                          {/* Rich Attachment Rendering */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mt-1 mb-1">
                              {msg.attachments.map((att: any, aIdx: number) => (
                                <div key={aIdx} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isMe ? 'bg-black/5 border-black/10' : 'bg-black/20 border-white/10'}`}>
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-black/10' : 'bg-white/10'}`}>
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-[13px] truncate">{att.name}</p>
                                    <p className={`text-[10px] uppercase tracking-wider ${isMe ? 'text-black/50' : 'text-white/40'}`}>
                                      Document • {Math.floor(Math.random() * 800 + 100)} KB
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Text Content */}
                          {msg.message && <div className="whitespace-pre-wrap">{msg.message}</div>}

                          {/* Read Receipts */}
                          {isMe && msg.status && (
                            <div className="flex justify-end mt-0.5">
                              {msg.status === 'sent' && <Check className="w-[14px] h-[14px] text-black/40" />}
                              {msg.status === 'delivered' && <CheckCheck className="w-[14px] h-[14px] text-black/40" />}
                              {msg.status === 'seen' && <CheckCheck className="w-[14px] h-[14px] text-blue-500" />}
                            </div>
                          )}
                        </div>
                      </div>
                    )})
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-white/[0.06]">
                  <AnimatePresence>
                    {attachment && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs text-white/80">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{attachment.name}</span>
                        </div>
                        <button onClick={() => setAttachment(null)} className="ml-3 hover:text-white/50 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="relative flex items-center">
                    <button 
                      className="absolute left-1.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 text-white/50 hover:text-white shrink-0"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '*/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) setAttachment(file);
                        };
                        input.click();
                      }}
                      title="Attach File"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Type a message..."
                      className="flex-1 h-11 pl-[44px] pr-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
                    />
                    <button onClick={sendMessage} disabled={!newMessage.trim() || sendingMessage} className="absolute right-1.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0 hover:scale-[1.05] active:scale-95 shadow-md shadow-[#f5c518]/20" style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}>
                      {sendingMessage ? <Loader2 className="w-3 h-3 text-black animate-spin" /> : <Send className="w-3 h-3 text-black" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL PROFILE MODAL ── */}
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
                  Freelancer Profile
                </h3>
                <button
                  onClick={() => setShowFullProfileModal(false)}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#f5c518]/20 to-[#c8960c]/5 border border-[#f5c518]/20 flex items-center justify-center text-4xl font-black text-[#f5c518] shadow-2xl shrink-0">
                    {profileViewerData.name?.[0] || 'W'}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-bold text-white mb-2">{profileViewerData.name}</h2>
                    <p className="text-[#f5c518] font-medium text-lg mb-2">{profileViewerData.headline || "Professional Freelancer"}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-4">
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {profileViewerData.location || "Global Workspace"}</span>
                      <span className="flex items-center gap-1.5 text-white/80"><span className="text-[#f5c518]">★</span> 4.9 (124 reviews)</span>
                      <span className="flex items-center gap-1.5 text-white/80">
                         <DollarSign className="w-4 h-4 text-[#f5c518]" /> 
                         {profileViewerData.pricingText || (profileViewerData.hourlyRate ? `${profileViewerData.hourlyRate}/hr` : "Rate not specified")}
                      </span>
                    </div>
                  </div>
                </div>

                {profileViewerData.bio && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">About</h4>
                    <p className="text-white/70 leading-relaxed text-sm bg-white/[0.02] p-4 rounded-2xl border border-white/[0.04]">
                      {profileViewerData.bio}
                    </p>
                  </div>
                )}

                {profileViewerData.skills?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-widest text-[#f5c518]">Expertise</h4>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {profileViewerData.skills.map((skill: string, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 rounded-full bg-white/5 text-white/80 text-sm border border-white/10 shadow-sm">
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Portfolio nested under expertise area */}
                    {profileViewerData.portfolio && profileViewerData.portfolio.length > 0 ? (
                      <div>
                        <h4 className="text-[11px] font-bold text-white/40 mb-4 uppercase tracking-[0.2em]">Portfolio & Previous Work</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {profileViewerData.portfolio.map((item: any, idx: number) => (
                            <div key={idx} className="group relative rounded-2xl overflow-hidden border border-white/[0.08] hover:border-[#f5c518]/30 transition-all bg-white/[0.02]">
                              <div className="aspect-video bg-white/[0.05]">
                                {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />}
                              </div>
                              <div className="p-4">
                                <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                                {item.description && <p className="text-xs text-white/40 mt-1 line-clamp-3">{item.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl border border-dashed border-white/5 text-center">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 text-white/10" />
                        <p className="text-xs text-white/20">No portfolio items available yet</p>
                      </div>
                    )}
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
                    setShowContractModal(true);
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-black transition-all hover:scale-105 shadow-xl shadow-[#f5c518]/20 text-sm flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f5c518, #c8960c)" }}
                >
                  <Check className="w-4 h-4" />
                  Hire Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
