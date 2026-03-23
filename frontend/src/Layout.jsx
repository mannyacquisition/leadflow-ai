import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthProvider";
import {
  LayoutDashboard, Bot, Megaphone, Users, Zap,
  Inbox, BarChart3, Puzzle, Settings, Bell, Gift,
  ChevronDown, LogOut, User, Terminal, Database
} from "lucide-react";
import MonaraPanel from "@/components/monara/MonaraPanel";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { label: "Copilot", icon: Bot, page: "Copilot", badge: "New" },
  { label: "Campaigns", icon: Megaphone, page: "Campaigns" },
  { label: "Contacts", icon: Users, page: "Contacts" },
  { label: "Signals Agents", icon: Zap, page: "SignalsAgents" },
  { label: "Unibox", icon: Inbox, page: "Unibox" },
  { label: "Insights", icon: BarChart3, page: "Insights" },
  { label: "Lead Database", icon: Database, page: "LeadDatabase" },
  { label: "Integrations", icon: Puzzle, page: "Integrations" },
  { label: "Command Center", icon: Terminal, page: "CommandCenter" },
  { label: "Settings", icon: Settings, page: "Settings" },
];

export default function Layout({ children, currentPageName }) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [monaraPanelOpen, setMonaraPanelOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/Login';
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-inter">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ backgroundColor: "#1a1f2b" }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#ff5a1f" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">LeadFlow AI</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, page, badge }) => {
            const isActive = currentPageName === page;
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                data-testid={`nav-${page.toLowerCase()}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                  isActive
                    ? "text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
                style={isActive ? { backgroundColor: "rgba(255,90,31,0.15)", color: "#ff5a1f" } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                {badge && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: "#ff5a1f" }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-3 border-t border-white/10 pt-3 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 text-gray-400 text-sm cursor-pointer hover:text-white">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: "#ff5a1f" }}>0</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 text-gray-400 text-sm cursor-pointer hover:text-white">
            <Gift className="w-4 h-4 text-green-400" />
            <span>Join Referral</span>
          </div>
          <div className="px-3 py-1 text-xs text-gray-500">Unlimited Emails · Pro Plan</div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              data-testid="user-menu-btn"
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: "#ff5a1f" }}>
                {user?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs font-medium text-white truncate">{user?.full_name || "User"}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email || ""}</div>
              </div>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border overflow-hidden z-50">
                <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                  <User className="w-4 h-4" /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  data-testid="logout-btn"
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Monara Floating Button */}
      <button
        onClick={() => setMonaraPanelOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-40 transition-transform hover:scale-110"
        style={{ backgroundColor: "#ff5a1f" }}
        title="Open Monara AI"
      >
        <Bot className="w-6 h-6 text-white" />
      </button>

      {/* Monara Slide-out Panel */}
      <MonaraPanel isOpen={monaraPanelOpen} onClose={() => setMonaraPanelOpen(false)} />
    </div>
  );
}
