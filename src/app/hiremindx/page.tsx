"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Loader2, Send, Layers3, Mic, MicOff, Copy, Check, Volume2, Mail, AlertCircle, History, X, Plus, Trash2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { useTheme } from "@/components/ThemeProvider";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { authClient } from "@/lib/auth-client";
import { HeroBackground } from "@/components/HeroBackground";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: UploadedFile[];
}

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}

interface ChatSession {
  id: number;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

const HIREMIND_GREETING = "Hello! I'm your AI job search agent. How can I help you today?";

export default function HireMindXPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isStartingNewChat, setIsStartingNewChat] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [devSession, setDevSession] = useState<{ user: { id: string; name: string; email: string } } | null>(null);
  const [checkingDevSession, setCheckingDevSession] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("devSession");
    if (stored) {
      setDevSession(JSON.parse(stored));
    }
    setCheckingDevSession(false);
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [hasGmailAccess, setHasGmailAccess] = useState<boolean | null>(null);
  const [emailProvider, setEmailProvider] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const isSavingRef = useRef(false);
  const sessionCreationPromiseRef = useRef<Promise<number | null> | null>(null);
  const [isUploading, setIsUploading] = useState(false);
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('hiremind_session_id');
      if (!id) {
        id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('hiremind_session_id', id);
      }
      setSessionId(id);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      setSessionId(session.user.id);
      localStorage.setItem('hiremind_session_id', session.user.id);
    }
  }, [session]);

  useEffect(() => {
    const fetchEmailToken = async () => {
      try {
        const response = await fetch('/api/gmail-token');
        const data = await response.json();
        if (data.accessToken) {
          setGmailToken(data.accessToken);
          setHasGmailAccess(true);
          setEmailProvider(data.provider || "google");
        } else {
          setHasGmailAccess(false);
        }
      } catch (error) {
        console.error('Failed to fetch email token:', error);
        setHasGmailAccess(false);
      }
    };

    if (session?.user) {
      fetchEmailToken();
    }
  }, [session]);

  // Re-check email status when window is focused
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user) {
        const fetchEmailToken = async () => {
          try {
            const response = await fetch('/api/gmail-token');
            const data = await response.json();
            if (data.accessToken) {
              setGmailToken(data.accessToken);
              setHasGmailAccess(true);
              setEmailProvider(data.provider || "google");
            } else {
              setHasGmailAccess(false);
            }
          } catch (error) {
            console.error('Failed to fetch email token:', error);
          }
        };
        fetchEmailToken();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session]);

  useEffect(() => {
    const fetchWelcome = async () => {
      if (welcomeLoaded) return;
      
        // Immediately set a default welcome message if none exist
        if (messages.length === 0) {
          setMessages([{
            id: "initial",
            role: "assistant",
            content: "👋 **Welcome back to HireMindX!** I'm preparing your workspace...",
            timestamp: new Date(),
          }]);
        }


      try {
        const response = await fetch('/api/hiremind/chat');
        const data = await response.json();
        if (data.output) {
          setMessages([{
            id: "initial",
            role: "assistant",
            content: data.output,
            timestamp: new Date(),
          }]);
        }
      } catch (error) {
        setMessages([{
          id: "initial",
          role: "assistant",
          content: HIREMIND_GREETING,
          timestamp: new Date(),
        }]);
      }
      setWelcomeLoaded(true);
    };
    
    if (session?.user || devSession) {
      fetchWelcome();
    }
  }, [session, devSession, welcomeLoaded, messages.length]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      const processedResults = new Set<string>();

      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcript = event.results[i][0].transcript.trim();
            const resultKey = `${i}-${transcript}`;
            if (transcript && !processedResults.has(resultKey)) {
              processedResults.add(resultKey);
              
              if (textareaRef.current) {
                const start = textareaRef.current.selectionStart;
                const end = textareaRef.current.selectionEnd;
                const text = textareaRef.current.value;
                const before = text.substring(0, start);
                const after = text.substring(end);
                const spaceBefore = before.length > 0 && !before.endsWith(" ") ? " " : "";
                const spaceAfter = after.length > 0 && !after.startsWith(" ") ? " " : "";
                const newValue = before + spaceBefore + transcript + spaceAfter + after;
                
                setInput(newValue);
                
                // We need to wait for the state update to set the cursor position
                setTimeout(() => {
                  if (textareaRef.current) {
                    const newPos = start + spaceBefore.length + transcript.length + spaceAfter.length;
                    textareaRef.current.selectionStart = newPos;
                    textareaRef.current.selectionEnd = newPos;
                    textareaRef.current.focus();
                  }
                }, 10);
              } else {
                setInput((prev) => prev + (prev ? " " : "") + transcript);
              }
            }
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListeningRef.current) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            setIsListening(false);
          }
        }
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        toast.error("Microphone not supported in this browser.");
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Speech recognition start error:', error);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'text/plain',
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type not supported: ${file.name}`);
        continue;
      }

        if (file.size > 4.5 * 1024 * 1024) {
          toast.error(`File too large (max 4.5MB): ${file.name}`);
          continue;
        }

      try {
        const base64 = await fileToBase64(file);
        newFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          base64,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error(`Failed to read file: ${file.name}`);
      }
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  useEffect(() => {
    if (!isPending && !checkingDevSession && !session?.user && !devSession) {
      router.push("/");
    }
  }, [session, isPending, router, devSession, checkingDevSession]);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const connectGmail = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/hiremindx",
        query: {
          access_type: "offline",
          prompt: "consent",
        }
      });
    } catch (error) {
      toast.error("Failed to connect email. Please try again.");
    }
  };

  const connectMicrosoft = async () => {
    try {
      await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: "/hiremindx",
      });
    } catch (error) {
      toast.error("Failed to connect Microsoft. Please try again.");
    }
  };

  const [lastMessageSent, setLastMessageSent] = useState<string | null>(null);

  const sendMessage = async (userMessage: string) => {
    if ((!userMessage.trim() && uploadedFiles.length === 0) || isLoading) return;

    setLastMessageSent(userMessage);
    const currentFiles = [...uploadedFiles];
    const userMsg: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: "user",
      content: userMessage || (currentFiles.length > 0 ? `Attached ${currentFiles.length} file(s)` : ''),
      timestamp: new Date(),
      files: currentFiles.length > 0 ? currentFiles : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setUploadedFiles([]);
    setIsLoading(true);
    setAutoScroll(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== "initial")
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const attachments = currentFiles.map(f => ({
        name: f.name,
        type: f.type,
        base64: f.base64,
      }));

      const response = await fetch('/api/hiremind/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatInput: userMessage || (currentFiles.length > 0 ? `I've attached ${currentFiles.length} file(s). Please use these as attachments when sending emails.` : ''),
          conversationHistory,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      if (response.status === 401) {
          setHasGmailAccess(false);
          throw new Error("Unauthorized or email disconnected");
      }

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

        const data = await response.json();
        
        if (data.reason === "no_gmail_token" || data.reason === "no_email_token") {
            setHasGmailAccess(false);
            toast.error("Email not connected. Please connect Gmail or Microsoft to send emails.", {
              action: {
                label: "Connect",
                onClick: () => connectGmail()
              }
            });
          } else if (data.emailsSent) {
          setHasGmailAccess(true);
          toast.success("Emails sent successfully!");
        }
        
        let aiResponse = "";
        if (data.output) {
          aiResponse = data.output;
        } else if (data.message) {
          aiResponse = data.message;
        } else if (data.error) {
          aiResponse = `⚠️ **Error:** ${data.error}`;
        } else {
          aiResponse = "I'm having trouble processing your request. Please try rephrasing or refreshing the page.";
        }

        if (data.error && !data.output) {
          console.error("API Error:", data.error);
          toast.error(data.error);
        }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setLastMessageSent(null);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Failed to send message. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (lastMessageSent) {
      // Remove the last error message if it exists
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.id.startsWith('error-')) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      sendMessage(lastMessageSent);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Copied to clipboard");
    });
  };

  const speak = (text: string, id: string) => {
    if ('speechSynthesis' in window) {
      if (speakingId === id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }
      
      window.speechSynthesis.cancel();
      
      // Filter out markdown formatting from the text for cleaner speech
      const cleanText = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
        .replace(/[*_~`]/g, '') // remove markdown special chars
        .replace(/#+\s/g, ''); // remove headers
        
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Try to find a high-quality natural voice
      const voices = window.speechSynthesis.getVoices();
      
      // Preferred voices in order
      const preferredVoices = [
        "Google US English",
        "Microsoft Aria Online (Natural)",
        "Microsoft Guy Online (Natural)",
        "Samantha",
        "Alex"
      ];
      
      let selectedVoice = voices.find(v => v.lang === 'en-US' && preferredVoices.some(p => v.name.includes(p)));
      
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Premium') || v.name.includes('Natural')));
      }
      
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        setSpeakingId(null);
      };
      
      setSpeakingId(id);
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error("Text-to-speech not supported in this browser");
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await fetch('/api/chat-history?chatType=hiremind');
      const data = await response.json();
      if (data.sessions) {
        setChatHistory(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchChatHistory();
    }
  }, [session]);

  const messagesRef = useRef<Message[]>([]);
  const currentSessionIdRef = useRef<number | null>(null);
  const savedMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    savedMessageIdsRef.current = savedMessageIds;
  }, [savedMessageIds]);

  const saveCurrentSession = useCallback(async () => {
    const currentMessages = messagesRef.current;
    const currentSessionId = currentSessionIdRef.current;
    const savedMessageIds = savedMessageIdsRef.current;
    const currentUser = session?.user;

    if (currentMessages.length <= 1 || isSavingRef.current || !currentUser || isStartingNewChat) return;
    
    isSavingRef.current = true;
    
    try {
      if (sessionCreationPromiseRef.current) {
        await sessionCreationPromiseRef.current;
      }

      const firstUserMessage = currentMessages.find(m => m.role === 'user');
      const title = firstUserMessage?.content.slice(0, 50) || 'New Chat';
      
      const latestSessionId = currentSessionIdRef.current;

      if (latestSessionId) {
        const newMessages = currentMessages.filter(m => 
          m.id !== 'initial' && 
          !savedMessageIdsRef.current.has(m.id)
        );
        
        if (newMessages.length > 0) {
          const response = await fetch(`/api/chat-history/${latestSessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: newMessages.map(m => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp.toISOString(),
              })),
            }),
          });
          
            if (response.ok) {
              const newSet = new Set(savedMessageIdsRef.current);
              newMessages.forEach(m => newSet.add(m.id));
              setSavedMessageIds(newSet);
              savedMessageIdsRef.current = newSet;
            }
          }
        } else if (!sessionCreationPromiseRef.current) {
          const messagesToSave = currentMessages.filter(m => m.id !== 'initial');
          if (messagesToSave.length > 0) {
            const createPromise = (async () => {
              try {
                const response = await fetch('/api/chat-history', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chatType: 'hiremind',
                    title,
                    messages: messagesToSave.map(m => ({
                      role: m.role,
                      content: m.content,
                      timestamp: m.timestamp.toISOString(),
                    })),
                  }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  if (data.session) {
                    setCurrentSessionId(data.session.id);
                    const newSet = new Set(messagesToSave.map(m => m.id));
                    setSavedMessageIds(newSet);
                    savedMessageIdsRef.current = newSet;
                    return data.session.id as number;
                  }
                }
              return null;
            } finally {
              sessionCreationPromiseRef.current = null;
            }
          })();
          
          sessionCreationPromiseRef.current = createPromise;
          await createPromise;
        }
      }
      fetchChatHistory();
    } catch (error) {
      console.error('Error saving session:', error);
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 500);
    }
  }, [session, fetchChatHistory, isStartingNewChat]);


  useEffect(() => {
    if (messages.length > 1 && session?.user) {
      const debounce = setTimeout(() => {
        saveCurrentSession();
      }, 2000);
      return () => clearTimeout(debounce);
    }
  }, [messages.length, session?.user?.id, saveCurrentSession]);


  const loadSession = async (historySessionId: number) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/chat-history/${historySessionId}`);
      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        const loadedMessages: Message[] = data.messages.map((m: any) => ({
          id: m.id.toString(),
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));
        setMessages(loadedMessages);
        setCurrentSessionId(historySessionId);
        setSavedMessageIds(new Set(loadedMessages.map(m => m.id)));
        setShowHistory(false);
        setAutoScroll(true);
      } else {
        toast.error('No messages found in this chat');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Failed to load chat session');
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteSession = async (historySessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat-history/${historySessionId}`, { method: 'DELETE' });
      fetchChatHistory();
      if (currentSessionId === historySessionId) {
        startNewChat();
      }
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat');
    }
    };

    const startNewChat = async () => {
    if (isStartingNewChat) return;
    setIsStartingNewChat(true);
    try {
      const response = await fetch('/api/hiremind/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await response.json();
      setMessages([{
        id: "initial",
        role: "assistant",
        content: data.output || HIREMIND_GREETING,
        timestamp: new Date(),
      }]);
    } catch {
      setMessages([{
        id: "initial",
        role: "assistant",
        content: HIREMIND_GREETING,
        timestamp: new Date(),
      }]);
    } finally {
      setCurrentSessionId(null);
      setSavedMessageIds(new Set());
      setShowHistory(false);
      setIsStartingNewChat(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (isPending || checkingDevSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentUser = session?.user || devSession?.user;
  if (!currentUser) return null;

  const isDark = theme === 'dark';

  return (
    <div className="relative h-[100dvh] overflow-hidden">
      <HeroBackground />
      <div className={`relative z-10 flex h-full ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex md:relative md:inset-auto">
            <div 
              className={`fixed inset-0 ${isDark ? 'bg-black/70' : 'bg-black/30'} md:hidden`}
              onClick={() => setShowHistory(false)}
            />
            <div className={`relative w-72 max-w-[85vw] md:w-64 ${isDark ? 'bg-zinc-900/40 backdrop-blur-xl border-white/10' : 'bg-white/40 backdrop-blur-xl border-white/40'} border-r h-full flex flex-col z-10 animate-in slide-in-from-left duration-300`}>
              <div className={`p-3 ${isDark ? 'border-white/5' : 'border-black/5'} border-b flex items-center justify-between`}>
                <h2 className="text-sm font-semibold">Chat History</h2>
                <Button variant="ghost" size="icon" className={`h-8 w-8 md:hidden ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} onClick={() => setShowHistory(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-2">
                <Button 
                  onClick={startNewChat}
                  variant="outline"
                  className={`w-full flex items-center gap-2 h-9 text-sm ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white' : 'bg-white/60 border-black/10 hover:bg-white/80 text-gray-900'}`}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {chatHistory.length === 0 ? (
                  <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'} text-center py-8`}>
                    No chat history yet
                  </p>
                ) : (
                  chatHistory.map((chatSession) => (
                    <div
                      key={chatSession.id}
                      onClick={() => loadSession(chatSession.id)}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center gap-2 ${
                        currentSessionId === chatSession.id 
                          ? isDark ? 'bg-white/10' : 'bg-black/5'
                          : isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{chatSession.title}</p>
                        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                          {formatDate(chatSession.lastMessageAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 flex-shrink-0 ${isDark ? 'text-zinc-500 hover:text-red-400 hover:bg-red-400/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                        onClick={(e) => deleteSession(chatSession.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
  
        <div className="flex-1 flex flex-col min-w-0">
            <header className={`h-12 flex items-center px-4 gap-3 flex-shrink-0 border-b ${isDark ? 'bg-white/5 border-white/5 backdrop-blur-md' : 'bg-white/40 border-black/5 backdrop-blur-md'}`}>
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Layers3 className="w-5 h-5 text-primary" />
                <span className="font-semibold">HireMindX</span>
              </Link>
            <div className="flex-1" />
            {hasGmailAccess === false && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={connectGmail}
                    className={`flex items-center gap-2 h-8 text-xs ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/60 border-black/10 hover:bg-white/80'}`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Connect Email</span>
                  </Button>
                </div>
              )}
              {hasGmailAccess === true && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{emailProvider === "microsoft" ? "Outlook" : "Gmail"}</span>
                </div>
              )}
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewChat}
              className={`gap-1.5 ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4" />
            </Button>
          </header>

        {hasGmailAccess === false && (
          <div className={`flex-shrink-0 px-4 py-2 flex items-center gap-2 text-xs ${isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>
                Connect your email (Gmail or Outlook) to let the AI agent send emails.{" "}
                <button onClick={connectGmail} className="underline font-medium hover:no-underline">
                  Connect now
              </button>
            </p>
          </div>
        )}

        {loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div 
            ref={scrollViewportRef}
            className="flex-1 overflow-y-auto"
            onScroll={(e) => {
              const target = e.currentTarget;
              const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
              setAutoScroll(isAtBottom);
            }}
          >
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === "assistant" ? (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <Layers3 className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                          <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert text-zinc-200' : 'text-gray-800'}`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node, ...props }) => (
                                  <a 
                                    {...props} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 dark:text-blue-400 font-bold underline decoration-2 underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 transition-all break-all" 
                                  />
                                )
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                          {message.id.startsWith('error-') && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={retryLastMessage}
                              className="mt-2 text-xs h-7 gap-1.5"
                            >
                              <Plus className="w-3 h-3 rotate-45" />
                              Retry
                            </Button>
                          )}
                          {message.id !== "initial" && !message.id.startsWith('error-') && (
                          <div className="flex items-center gap-1 mt-3">
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                              title="Copy"
                            >
                              {copiedId === message.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => speak(message.content, message.id)}
                              className={`p-1.5 rounded-md transition-colors ${
                                speakingId === message.id 
                                  ? 'text-primary' 
                                  : isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
                              }`}
                              title="Listen"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-3">
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.files && message.files.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-primary-foreground/20 flex flex-wrap gap-2">
                            {message.files.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 bg-primary-foreground/10 rounded-lg px-2 py-1 text-xs">
                                {getFileIcon(file.type)}
                                <span className="max-w-[100px] truncate">{file.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${isDark ? 'bg-zinc-700 text-white' : 'bg-gray-300 text-gray-700'}`}>
                        {currentUser.name?.charAt(0).toUpperCase() || "U"}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                    <Layers3 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div className={`flex items-center gap-2 pt-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <div className="p-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              {uploadedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${isDark ? 'bg-white/5 backdrop-blur-md border border-white/10 text-zinc-200' : 'bg-white/40 backdrop-blur-xl border border-black/5 text-gray-700'}`}
                    >
                      {getFileIcon(file.type)}
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className={`p-0.5 rounded transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-red-400' : 'hover:bg-gray-200 text-gray-400 hover:text-red-500'}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.txt"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className={`relative flex items-end rounded-3xl border transition-all duration-300 ${isDark ? 'bg-zinc-900/60 backdrop-blur-xl border-white/10 focus-within:border-white/20' : 'bg-white/60 backdrop-blur-xl border-black/10 focus-within:border-black/20'}`}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading || isUploading}
                    className={`p-3 transition-colors disabled:opacity-50 ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Attach file"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Paperclip className="w-5 h-5" />
                    )}
                  </button>
                  
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={uploadedFiles.length > 0 ? "Add a message or send files..." : "Type your message..."}
                    disabled={isLoading}
                    rows={1}
                    className={`flex-1 bg-transparent resize-none py-3 text-sm focus:outline-none max-h-[200px] ${isDark ? 'text-white placeholder:text-zinc-500' : 'text-gray-900 placeholder:text-gray-400'}`}
                    style={{ minHeight: '24px' }}
                  />
                  
                  <div className="flex items-center gap-0.5 p-2">
                    <button
                      type="button"
                      onClick={toggleListening}
                      disabled={isLoading}
                      className={`p-2 rounded-full transition-colors ${
                        isListening 
                          ? "bg-red-500 text-white" 
                          : isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
                      }`}
                      title={isListening ? "Stop listening" : "Voice input"}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      type="submit"
                      disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
                      className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                      title="Send message"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}