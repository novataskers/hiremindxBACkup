"use client";

import { useEffect } from "react";
import { MessageSquare, FileText, BookOpen, Users, ChevronRight } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLanguage } from "@/components/LanguageProvider";
import { useTranslation } from "@/lib/translations";
import { HeroBackground } from "@/components/HeroBackground";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const { language } = useLanguage();
  const t = useTranslation(language);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/");
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="relative min-h-screen bg-black flex items-center justify-center">
        <HeroBackground />
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) return null;

  const cards = [
    {
      icon: MessageSquare,
      title: t.hiremindChat,
      desc: t.hiremindChatDesc,
      href: "/hiremind",
      disabled: false,
    },
    {
      icon: BookOpen,
      title: t.hiremindStudy,
      desc: t.hiremindStudyDesc,
      href: "/study/bulk-cv",
      disabled: false,
    },
    {
      icon: Users,
      title: t.communityAndWorkspace,
      desc: t.communityAndWorkspaceDesc,
      href: "/community",
      disabled: false,
      badge: null,
    },
    {
      icon: FileText,
      title: t.uploadResume,
      desc: t.uploadResumeDesc,
      href: null,
      disabled: true,
      badge: t.comingSoon,
    },
  ];

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-white/10">
      <HeroBackground />
      <div className="relative z-10">
        <Header />

        <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">

            {/* Page heading */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-10 lg:mb-14"
            >
              <p className="text-[10px] tracking-[0.4em] uppercase font-semibold text-zinc-500 mb-3">
                Dashboard
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-none">
                {t.welcomeBack},<br />
                <span className="text-zinc-400">{session.user.name?.split(" ")[0]}</span>
              </h1>
              <p className="mt-4 text-zinc-400 text-sm sm:text-base max-w-xl leading-relaxed">
                {t.dashboardSubtitle}
              </p>
            </motion.div>

            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {cards.map((card, i) => {
                const Icon = card.icon;
                const inner = (
                  <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                    onClick={() => !card.disabled && card.href && router.push(card.href)}
                    className={`group relative flex items-center justify-between gap-4 px-5 py-4 sm:py-5 rounded-2xl border transition-all duration-300 ${
                      card.disabled
                        ? "bg-zinc-900/30 border-white/[0.05] opacity-50 cursor-not-allowed"
                        : "bg-zinc-900/50 border-white/[0.08] hover:bg-zinc-900/80 hover:border-white/10 cursor-pointer shadow-xl"
                    }`}
                  >
                    {/* left */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-[15px] font-semibold text-zinc-200 group-hover:text-white transition-colors tracking-tight">
                          {card.title}
                        </h3>
                        <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors mt-0.5 line-clamp-1">
                          {card.desc}
                        </p>
                      </div>
                    </div>

                    {/* right */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {card.badge && (
                        <span className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 bg-white/5 border border-white/[0.06] px-2 py-1 rounded-full">
                          {card.badge}
                        </span>
                      )}
                      {!card.disabled && (
                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-300" />
                      )}
                    </div>
                  </motion.div>
                );
                return inner;
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
