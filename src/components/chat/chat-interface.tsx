"use client";

import { useState, useEffect, useRef } from "react";
import { useFirestore } from "@/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp | null;
}

interface ChatInterfaceProps {
  jobId: string;
  currentUserUid: string;
  currentUserName: string;
}

export function ChatInterface({ jobId, currentUserUid, currentUserName }: ChatInterfaceProps) {
  const firestore = useFirestore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firestore) return;

    const messagesRef = collection(firestore, "jobs", jobId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [firestore, jobId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firestore) return;

    const textToSubmit = newMessage;
    setNewMessage("");

    try {
      await addDoc(collection(firestore, "jobs", jobId, "messages"), {
        text: textToSubmit,
        senderId: currentUserUid,
        senderName: currentUserName,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      // Could add a toast notification here if it fails
    }
  };

  return (
    <Card className="flex flex-col h-[500px] border-none shadow-xl">
      <CardHeader className="bg-primary text-white rounded-t-xl py-4">
        <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-primary-foreground">
          <MessageSquare className="w-5 h-5 text-accent" />
          Job Communications
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
            <MessageSquare className="w-10 h-10 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserUid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 ml-1">
                    {msg.senderName}
                  </span>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                    isMe
                      ? "bg-accent text-white rounded-tr-none shadow-md shadow-accent/20"
                      : "bg-white text-slate-800 rounded-tl-none shadow-sm border border-slate-100"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.createdAt && (
                  <span className="text-[10px] font-bold text-slate-400 mt-1 mx-1">
                    {format(msg.createdAt.toDate(), "h:mm a")}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      
      <CardFooter className="p-4 bg-white border-t border-slate-100 rounded-b-xl">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 h-12 bg-slate-50 border-none font-medium text-sm focus-visible:ring-accent"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()} className="h-12 w-12 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md">
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
