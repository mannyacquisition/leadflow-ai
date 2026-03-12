import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Search, Filter, Edit, Linkedin, Globe } from "lucide-react";

const mockConversations = [
  { id: "1", name: "Adrian B. Siggerud", preview: "Adrian, noticed you...", time: "8 hours ago", unread: true, avatar: "A" },
  { id: "2", name: "Meg Bear", preview: "Meg, saw you engaging...", time: "8 hours ago", unread: false, avatar: "M" },
  { id: "3", name: "Michael Williamson", preview: "Michael, noticed you're...", time: "8 hours ago", unread: false, avatar: "MW" },
  { id: "4", name: "Harshul Gupta", preview: "Will the model be trained on...", time: "a day ago", unread: false, avatar: "H", hot: true },
  { id: "5", name: "Hugo Pochet", preview: "Hugo, saw your post on col...", time: "a day ago", unread: false, avatar: "HP" },
  { id: "6", name: "Dmytro Nasyrov, PhD", preview: "Dmytro - if helpful, I can...", time: "a day ago", unread: false, avatar: "D" },
  { id: "7", name: "Angelo Kahloun", preview: "Angelo - if helpful, I can shar...", time: "a day ago", unread: false, avatar: "AK" },
  { id: "8", name: "Katarina Perisic", preview: "Katarina, saw you engaging...", time: "a day ago", unread: false, avatar: "K" },
  { id: "9", name: "Sho Kaneko", preview: "Sho, saw you engaging with...", time: "a day ago", unread: false, avatar: "S" },
  { id: "10", name: "Rupendra Raavi", preview: "Hi Manny, Your work as a...", time: "a day ago", unread: false, avatar: "R" },
  { id: "11", name: "Panos Meintanis", preview: "Gotcha. how could the valu...", time: "a day ago", unread: false, avatar: "PM" },
];

const adrianMessages = [
  {
    id: "1",
    role: "outbound",
    sender: "Manny Artino",
    time: "8 hours ago",
    body: `Adrian, noticed you checked out my profile.

Quick q - how many times have you re-explained your product and ICP to GPT/ Claude this week?

Recently built GrowthCodex, AI consultant that generates your strategy and builds your assets in one click. (email outreach, post sign up flows etc.)

Different how? it's built on private benchmark data that YC uses, and $100M ARR SaaS playbooks

Saved our done-for-you clients 20+ hrs a week and $200k/yr in payroll, and confident it can do the same

Launching next Monday with 20 founding beta spots. Reply 'yes' if interested and I'll send you the link with a community of founders.`,
  }
];

const adrianContact = {
  name: "Adrian B. Siggerud",
  title: "Founder, CEO & Board Director",
  company: "Campaign Shark",
  company_size: "1employees",
  signal: "Just engaged with your profile",
  industry: "Computer Software",
  location: "Norway",
  website: "https://adsplayground.com",
};

export default function Unibox() {
  const [conversations, setConversations] = useState(mockConversations);
  const [selectedConv, setSelectedConv] = useState(mockConversations[0]);
  const [messages, setMessages] = useState(adrianMessages);
  const [newMessage, setNewMessage] = useState("");
  const [page, setPage] = useState(1);
  const CONV_PER_PAGE = 20;

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    setMessages([...messages, {
      id: Date.now().toString(),
      role: "outbound",
      sender: "Manny Artino",
      time: "Just now",
      body: newMessage,
    }]);
    setNewMessage("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Unibox</h1>
          <p className="text-sm text-gray-500">Unified inbox for all your conversations</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>⚙️</span>
          <span className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">M</div>
            Manny Artino ▾
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-64 border-r bg-white flex flex-col flex-shrink-0">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-gray-900">Conversations</span>
              <div className="flex gap-2 text-gray-400">
                <Filter className="w-4 h-4 cursor-pointer hover:text-gray-600" />
                <Search className="w-4 h-4 cursor-pointer hover:text-gray-600" />
              </div>
            </div>
            <div className="text-xs text-gray-400">50 conversation(s)</div>
          </div>

          <div className="p-3 border-b">
            <button className="w-full flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Edit className="w-4 h-4" /> Compose
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`p-3 flex items-start gap-2.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                  selectedConv?.id === conv.id ? "bg-orange-50 border-l-2 border-l-orange-500" : ""
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                  conv.unread ? "" : "opacity-90"
                }`} style={{ backgroundColor: "#ff5a1f" }}>
                  {conv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${conv.unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                      {conv.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{conv.time}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {conv.hot && <span>🔥</span>}
                    {conv.preview}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Chat */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {selectedConv && (
            <>
              <div className="px-4 py-3 bg-white border-b flex items-center gap-2">
                <span className="font-semibold text-gray-900">{selectedConv.name}</span>
                <Linkedin className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-400">{adrianMessages.length} message(s)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-lg">
                      <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                        <span>{msg.time}</span>
                        <span>{msg.sender}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                        msg.role === "outbound"
                          ? "bg-orange-50 text-gray-800 border border-orange-100"
                          : "bg-white text-gray-800 border"
                      }`}>
                        {msg.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message input */}
              <div className="bg-white border-t p-3">
                <div className="border rounded-xl overflow-hidden">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    rows={3}
                    className="w-full px-4 pt-3 pb-1 text-sm resize-none focus:outline-none"
                    onKeyDown={e => {
                      if (e.key === "Enter" && e.ctrlKey) sendMessage();
                    }}
                  />
                  <div className="flex items-center justify-between px-3 pb-2">
                    <div className="flex gap-2 text-gray-400 text-xs">
                      <span>📎</span>
                      <span>🎤</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Ctrl ↵</span>
                      <button
                        onClick={sendMessage}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: "#ff5a1f" }}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Contact info */}
        <div className="w-64 border-l bg-white overflow-y-auto flex-shrink-0">
          <div className="p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Contact Information</h3>
            <p className="text-xs text-gray-400 mb-4">{adrianContact.company}</p>

            <div className="flex flex-col items-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 mb-3 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl font-semibold">A</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900 flex items-center gap-1 justify-center">
                  {adrianContact.name}
                  <Linkedin className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-xs text-gray-500">{adrianContact.title}</div>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">COMPANY</div>
                <div className="flex items-center gap-1 font-medium text-gray-800">
                  {adrianContact.company}
                  <Linkedin className="w-3 h-3 text-blue-600" />
                </div>
                <div className="text-xs text-gray-500">{adrianContact.company_size}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">SIGNAL</div>
                <div className="text-xs text-blue-600 cursor-pointer">{adrianContact.signal}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">INDUSTRY</div>
                <div className="text-xs text-gray-700">{adrianContact.industry}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">LOCATION</div>
                <div className="text-xs text-gray-700">{adrianContact.location}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">WEBSITE</div>
                <a href={adrianContact.website} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> {adrianContact.website.replace("https://", "")}
                </a>
              </div>
              <button className="text-xs text-orange-500 font-medium flex items-center gap-1">View more ›</button>
            </div>

            <button className="w-full mt-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Export</button>
          </div>
        </div>
      </div>
    </div>
  );
}