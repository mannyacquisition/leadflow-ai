import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Search, Filter, Edit, Linkedin, Globe } from "lucide-react";

const mockConversations = [
  { id: "1", name: "Adrian B. Siggerud", preview: "Adrian, noticed you...", time: "8 hours ago", unread: true, avatar: "A", title: "Founder, CEO & Board Director", company: "Campaign Shark", company_size: "1 employee", signal: "Just engaged with your profile", industry: "Computer Software", location: "Norway", website: "https://adsplayground.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "8 hours ago", body: `Adrian, noticed you checked out my profile.\n\nQuick q - how many times have you re-explained your product and ICP to GPT/ Claude this week?\n\nRecently built GrowthCodex, AI consultant that generates your strategy and builds your assets in one click.\n\nDifferent how? it's built on private benchmark data that YC uses, and $100M ARR SaaS playbooks\n\nSaved our done-for-you clients 20+ hrs a week and $200k/yr in payroll.\n\nLaunching next Monday with 20 founding beta spots. Reply 'yes' if interested.` }] },
  { id: "2", name: "Meg Bear", preview: "Meg, saw you engaging...", time: "8 hours ago", unread: false, avatar: "M", title: "VP of Product", company: "Oracle", company_size: "10,000+ employees", signal: "Liked your LinkedIn post", industry: "Enterprise Software", location: "San Francisco, CA", website: "https://oracle.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "8 hours ago", body: `Meg, saw you engaging with my post on AI-powered outreach.\n\nThought you'd appreciate a direct example — we helped a SaaS team cut their outbound research time by 80% using our AI workflow.\n\nWould love to share the playbook if useful?` }] },
  { id: "3", name: "Michael Williamson", preview: "Michael, noticed you're...", time: "8 hours ago", unread: false, avatar: "MW", title: "Head of Sales", company: "Stripe", company_size: "5,000 employees", signal: "Visited your profile", industry: "FinTech", location: "New York, NY", website: "https://stripe.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "8 hours ago", body: `Michael, noticed you're scaling the sales team at Stripe.\n\nWe've been helping revenue leaders automate their outbound prospecting — saving 15+ hours per SDR per week.\n\nOpen to a quick 15 min to see if it's relevant?` }] },
  { id: "4", name: "Harshul Gupta", preview: "Will the model be trained on...", time: "a day ago", unread: false, avatar: "H", hot: true, title: "AI Research Lead", company: "DeepMind", company_size: "1,000 employees", signal: "Replied to your message", industry: "AI / ML", location: "London, UK", website: "https://deepmind.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "2 days ago", body: `Harshul, loved your recent paper on RLHF.\n\nQuick question - are you exploring ways to apply this to enterprise sales intelligence?\n\nWe're building something adjacent and would love your perspective.` }, { id: "m2", role: "inbound", sender: "Harshul Gupta", time: "a day ago", body: "Will the model be trained on domain-specific data? That's the key differentiator in my experience." }] },
  { id: "5", name: "Hugo Pochet", preview: "Hugo, saw your post on col...", time: "a day ago", unread: false, avatar: "HP", title: "Co-Founder", company: "Slite", company_size: "50 employees", signal: "Commented on your post", industry: "SaaS", location: "Paris, France", website: "https://slite.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "a day ago", body: `Hugo, saw your post on collaborative documentation tools.\n\nWe're helping SaaS founders like you automate their GTM content — think AI-generated onboarding sequences, outreach, and more.\n\nWorth a look?` }] },
  { id: "6", name: "Dmytro Nasyrov, PhD", preview: "Dmytro - if helpful, I can...", time: "a day ago", unread: false, avatar: "D", title: "CTO", company: "Grammarly", company_size: "800 employees", signal: "Followed you on LinkedIn", industry: "NLP / AI", location: "Kyiv, Ukraine", website: "https://grammarly.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "a day ago", body: `Dmytro - if helpful, I can share a case study on how we reduced engineering onboarding time by 60% using AI documentation flows.\n\nLet me know if that's useful context for your team.` }] },
  { id: "7", name: "Angelo Kahloun", preview: "Angelo - if helpful, I can shar...", time: "a day ago", unread: false, avatar: "AK", title: "Sales Director", company: "HubSpot", company_size: "7,000 employees", signal: "Viewed your company page", industry: "CRM / Sales Tech", location: "Boston, MA", website: "https://hubspot.com", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "a day ago", body: `Angelo - if helpful, I can share how we helped a HubSpot partner agency 3x their pipeline in 90 days using AI-driven outreach sequences.\n\nHappy to forward the breakdown?` }] },
  { id: "8", name: "Katarina Perisic", preview: "Katarina, saw you engaging...", time: "a day ago", unread: false, avatar: "K", title: "Marketing Lead", company: "Notion", company_size: "500 employees", signal: "Liked 3 of your posts", industry: "Productivity SaaS", location: "Belgrade, Serbia", website: "https://notion.so", messages: [{ id: "m1", role: "outbound", sender: "Manny Artino", time: "a day ago", body: `Katarina, saw you engaging with multiple posts on AI-driven marketing.\n\nWe're building exactly that — AI that writes, personalizes, and sends your outbound campaigns.\n\nInterested in an early access invite?` }] },
];

export default function Unibox() {
  const [conversations] = useState(mockConversations);
  const [selectedConv, setSelectedConv] = useState(mockConversations[0]);
  const [messagesByConv, setMessagesByConv] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv, messagesByConv]);

  const currentMessages = messagesByConv[selectedConv?.id] ?? selectedConv?.messages ?? [];

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedConv) return;
    const updated = [...currentMessages, {
      id: Date.now().toString(),
      role: "outbound",
      sender: "Manny Artino",
      time: "Just now",
      body: newMessage,
    }];
    setMessagesByConv(prev => ({ ...prev, [selectedConv.id]: updated }));
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
            <div className="text-xs text-gray-400">{conversations.length} conversation(s)</div>
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
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: "#ff5a1f" }}>
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
                <span className="text-xs text-gray-400">{currentMessages.length} message(s)</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentMessages.map(msg => (
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
                <div ref={bottomRef} />
              </div>

              <div className="bg-white border-t p-3">
                <div className="border rounded-xl overflow-hidden">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    rows={3}
                    className="w-full px-4 pt-3 pb-1 text-sm resize-none focus:outline-none"
                    onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) sendMessage(); }}
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

        {/* Right: Contact info — fully driven by selectedConv */}
        {selectedConv && (
          <div className="w-64 border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Contact Information</h3>
              <p className="text-xs text-gray-400 mb-4">{selectedConv.company}</p>

              <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold mb-3"
                  style={{ backgroundColor: "#ff5a1f" }}>
                  {selectedConv.avatar}
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-900 flex items-center gap-1 justify-center">
                    {selectedConv.name}
                    <Linkedin className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-xs text-gray-500">{selectedConv.title}</div>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">COMPANY</div>
                  <div className="flex items-center gap-1 font-medium text-gray-800">
                    {selectedConv.company}
                    <Linkedin className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-xs text-gray-500">{selectedConv.company_size}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">SIGNAL</div>
                  <div className="text-xs text-blue-600 cursor-pointer">{selectedConv.signal}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">INDUSTRY</div>
                  <div className="text-xs text-gray-700">{selectedConv.industry}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">LOCATION</div>
                  <div className="text-xs text-gray-700">{selectedConv.location}</div>
                </div>
                {selectedConv.website && (
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1 font-semibold">WEBSITE</div>
                    <a href={selectedConv.website} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-orange-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {selectedConv.website.replace("https://", "")}
                    </a>
                  </div>
                )}
                <button className="text-xs text-orange-500 font-medium flex items-center gap-1">View more ›</button>
              </div>

              <button className="w-full mt-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Export</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}