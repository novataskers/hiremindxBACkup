"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Check, Crown, Zap, Rocket, Star, Shield } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeroBackground } from "@/components/HeroBackground";
import { motion } from "framer-motion";

const plans = [
  {
    id: "basic",
    name: "Basic",
    description: "Perfect for getting started with your job search.",
    price: "$9",
    period: "/month",
    icon: Zap,
    features: [
      "10 AI Job Applications per month",
      "Basic CV Analysis",
      "Community Access",
      "Standard Email Templates",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "The most powerful tools for serious job seekers.",
    price: "$29",
    period: "/month",
    icon: Rocket,
    features: [
      "Unlimited AI Job Applications",
      "Advanced CV Deep Analysis",
      "Priority Email Outreach",
      "HireMindX Study Assistant",
      "Custom Networking Signals",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Business",
    description: "Custom solutions for teams and agencies.",
    price: "$99",
    period: "/month",
    icon: Star,
    features: [
      "Everything in Pro",
      "Team Collaboration Tools",
      "API Access",
      "Custom AI Training",
      "Dedicated Account Manager",
    ],
    popular: false,
  },
];

export default function PremiumPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/");
    }
  }, [session, isPending, router]);

  const handleUpgrade = (planId: string) => {
    setSelectedPlan(planId);
    toast.success(`Upgrading to ${plans.find(p => p.id === planId)?.name} plan...`, {
      description: "This is a demo. Payment integration coming soon!",
    });
  };

  if (isPending) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <HeroBackground />
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) return null;

  return (
      <div className="relative min-h-screen text-white selection:bg-white/10">
      <HeroBackground />
      <div className="relative z-10">
        <AppHeader />

        <main className="pt-24 sm:pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12 sm:mb-16"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-5">
                <Crown className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-400">Premium Access</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-none mb-4">
                Premium Plans
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Unlock the full potential of AI-powered job search. Choose the plan that fits your goals.
              </p>
            </motion.div>

            {/* Plans grid */}
            <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
              {plans.map((plan, i) => {
                const Icon = plan.icon;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                    className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 ${
                      plan.popular
                        ? "bg-white/[0.06] border-white/20 shadow-2xl"
                        : "bg-zinc-900/50 border-white/[0.08] hover:bg-zinc-900/80 hover:border-white/10"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-[10px] font-bold tracking-widest uppercase bg-white text-black px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-5">
                      <Icon className="w-4 h-4 text-zinc-300" />
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                    <p className="text-xs text-zinc-500 mb-5 leading-relaxed">{plan.description}</p>

                    <div className="mb-6">
                      <span className="text-4xl font-black text-white tracking-tighter">{plan.price}</span>
                      <span className="text-sm text-zinc-500 ml-1">{plan.period}</span>
                    </div>

                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <div className="mt-0.5 w-4 h-4 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                            <Check className="w-2.5 h-2.5 text-zinc-300" />
                          </div>
                          <span className="text-xs text-zinc-300 leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={selectedPlan === plan.id}
                      className={`w-full h-10 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        plan.popular
                          ? "bg-white text-black hover:bg-zinc-200"
                          : "bg-white/[0.06] border border-white/[0.08] text-zinc-200 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {selectedPlan === plan.id ? "Processing..." : "Get Started"}
                    </button>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-10 text-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">14-day money-back guarantee. Cancel anytime.</span>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
