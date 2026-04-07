"use client";

import Sidebar from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";

export default function Messages() {
  const conversations = [
    { name: "Sarah Chen", company: "TechCorp", lastMessage: "Thanks for your application!", time: "2h ago", unread: true },
    { name: "Mike Johnson", company: "StartupXYZ", lastMessage: "Would you be available for an interview?", time: "1d ago", unread: true },
    { name: "Emma Williams", company: "Innovation Labs", lastMessage: "Great to meet you!", time: "3d ago", unread: false },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <MessageSquare className="w-10 h-10" />
              Messages
            </h1>
            <p className="text-muted-foreground">Chat with recruiters and hiring managers</p>
          </div>

          <div className="grid grid-cols-3 gap-6 h-[600px]">
            {/* Conversations List */}
            <Card className="p-4 overflow-y-auto">
              <h2 className="font-semibold mb-4">Conversations</h2>
              <div className="space-y-2">
                {conversations.map((conv, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      conv.unread ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10 bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {conv.name[0]}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-sm truncate">{conv.name}</h3>
                          <span className="text-xs text-muted-foreground">{conv.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{conv.company}</p>
                        <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chat Area */}
            <Card className="col-span-2 p-6 flex flex-col">
              <div className="mb-4 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 bg-primary/20 flex items-center justify-center text-primary font-bold">
                    S
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">Sarah Chen</h3>
                    <p className="text-sm text-muted-foreground">TechCorp</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                <div className="flex justify-start">
                  <div className="bg-accent rounded-lg p-3 max-w-[70%]">
                    <p className="text-sm">Thanks for your application! We're reviewing it now.</p>
                    <span className="text-xs text-muted-foreground mt-1 block">2 hours ago</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input placeholder="Type your message..." className="flex-1" />
                <Button size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
