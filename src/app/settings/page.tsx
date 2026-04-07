"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Bot,
  CreditCard,
  Trash2,
  AlertTriangle,
  Crown,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { motion } from "framer-motion";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI Settings", icon: Bot },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "danger", label: "Danger Zone", icon: Trash2 },
];

export default function Settings() {
  const router = useRouter();
  const [active, setActive] = useState("profile");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      toast.success("Account deleted successfully");
      await authClient.signOut();
      localStorage.removeItem("bearer_token");
      router.push("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-16 lg:mt-0 mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-4">
              <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-400">Account</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white leading-none mb-2">
              Settings
            </h1>
            <p className="text-zinc-500 text-sm">Manage your account and preferences</p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Side nav */}
            <motion.nav
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:w-52 flex-shrink-0"
            >
              <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isDanger = s.id === "danger";
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActive(s.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                        active === s.id
                          ? isDanger
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-white/[0.08] text-white border border-white/[0.1]"
                          : isDanger
                          ? "text-red-500/60 hover:text-red-400 hover:bg-red-500/5"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </motion.nav>

            {/* Content */}
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 min-w-0"
            >
              {/* Profile */}
              {active === "profile" && (
                <Section icon={<User className="w-4 h-4 text-zinc-400" />} title="Profile">
                  <div className="space-y-4">
                    <Field label="Full Name">
                      <Input
                        defaultValue="Sarmag"
                        className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0"
                      />
                    </Field>
                    <Field label="Email">
                      <Input
                        type="email"
                        defaultValue="sarmag@example.com"
                        className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0"
                      />
                    </Field>
                    <Field label="Current Title">
                      <Input
                        defaultValue="Marketing Manager"
                        className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0"
                      />
                    </Field>
                    <div className="pt-2">
                      <button
                        onClick={() => toast.success("Profile saved")}
                        className="h-10 px-5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </Section>
              )}

              {/* Notifications */}
              {active === "notifications" && (
                <Section icon={<Bell className="w-4 h-4 text-zinc-400" />} title="Notifications">
                  <div className="space-y-1">
                    <ToggleRow
                      label="Email Notifications"
                      description="Receive email updates about your applications"
                      defaultChecked
                    />
                    <ToggleRow
                      label="New Job Matches"
                      description="Get notified when new jobs match your profile"
                      defaultChecked
                    />
                    <ToggleRow
                      label="Application Updates"
                      description="Alerts for application status changes"
                      defaultChecked
                    />
                    <ToggleRow
                      label="Weekly Digest"
                      description="A weekly summary of your job search activity"
                    />
                  </div>
                </Section>
              )}

              {/* AI Settings */}
              {active === "ai" && (
                <Section icon={<Bot className="w-4 h-4 text-zinc-400" />} title="AI Settings">
                  <div className="space-y-1 mb-6">
                    <ToggleRow
                      label="Auto-apply to Jobs"
                      description="Let AI automatically apply to matching positions"
                      defaultChecked
                    />
                    <ToggleRow
                      label="AI Follow-ups"
                      description="Allow AI to send follow-up messages on your behalf"
                      defaultChecked
                    />
                    <ToggleRow
                      label="Smart Matching"
                      description="Use AI to find highly relevant job opportunities"
                      defaultChecked
                    />
                  </div>
                  <Field label="Max Applications per Week">
                    <Input
                      type="number"
                      defaultValue="50"
                      className="h-11 rounded-xl bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 max-w-xs"
                    />
                  </Field>
                  <div className="pt-4">
                    <button
                      onClick={() => toast.success("AI settings saved")}
                      className="h-10 px-5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </Section>
              )}

              {/* Subscription */}
              {active === "subscription" && (
                <Section icon={<CreditCard className="w-4 h-4 text-zinc-400" />} title="Subscription">
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                          <Crown className="w-4 h-4 text-zinc-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Pro Plan</p>
                          <p className="text-xs text-zinc-500">Unlimited AI applications</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold tracking-widest uppercase bg-white text-black px-3 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="flex items-end gap-1 mb-4">
                      <span className="text-3xl font-black text-white tracking-tighter">$29</span>
                      <span className="text-sm text-zinc-500 mb-1">/month</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["Unlimited AI Applications", "Priority Support", "Advanced CV Analysis", "Custom Networking"].map((f) => (
                        <span key={f} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] text-zinc-300 border border-white/[0.08]">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push("/premium")}
                      className="h-10 px-5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-200 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 inline mr-1.5" />
                      Upgrade Plan
                    </button>
                    <button
                      onClick={() => toast.info("Subscription management coming soon")}
                      className="h-10 px-5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel Subscription
                    </button>
                  </div>
                </Section>
              )}

              {/* Danger Zone */}
              {active === "danger" && (
                <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </div>
                    <h2 className="text-base font-semibold text-red-400">Danger Zone</h2>
                  </div>

                  <div className="mb-5">
                    <p className="text-sm font-medium text-white mb-1">Delete Account</p>
                    <p className="text-xs text-zinc-500">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="h-10 px-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/40 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />
                      Delete My Account
                    </button>
                  ) : (
                    <div className="space-y-4 p-5 rounded-xl bg-red-950/20 border border-red-500/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-400 mb-1">Are you absolutely sure?</p>
                          <p className="text-xs text-zinc-500">
                            This will permanently delete your account, all chat history, saved data, and preferences.
                            Type <span className="font-bold text-zinc-300">DELETE</span> below to confirm.
                          </p>
                        </div>
                      </div>
                      <Input
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="h-11 rounded-xl bg-black/40 border-red-500/30 text-white placeholder:text-zinc-600 focus:border-red-500/60 focus:ring-0"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteInput("");
                          }}
                          className="flex-1 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] text-zinc-300 text-sm font-medium hover:bg-white/10 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteInput !== "DELETE" || isDeleting}
                          className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {isDeleting ? "Deleting..." : "Permanently Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-zinc-500 mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultChecked = false,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.05] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} className="flex-shrink-0" />
    </div>
  );
}
