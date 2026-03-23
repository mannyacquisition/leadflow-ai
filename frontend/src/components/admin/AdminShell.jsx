import React, { useState, useEffect } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthProvider";
import {
  LayoutDashboard, BookOpen, Puzzle, GitFork,
  Activity, ChevronLeft, Shield, Loader2
} from "lucide-react";

const NAV = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { path: "/admin/knowledge", label: "Knowledge Base", icon: BookOpen },
  { path: "/admin/tools", label: "Tool Registry", icon: Puzzle },
  { path: "/admin/studio", label: "Agent Studio", icon: GitFork },
  { path: "/admin/logs", label: "Execution Logs", icon: Activity },
];

export default function AdminShell({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/Login" />;

  if (!user?.is_admin) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white flex-col gap-4">
        <Shield className="w-10 h-10 text-purple-400" />
        <div className="text-center">
          <h2 className="text-xl font-bold">Admin Access Required</h2>
          <p className="text-gray-400 text-sm mt-1">You need admin privileges to access this area.</p>
        </div>
        <Link to="/Dashboard" className="text-purple-400 hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-wide text-white">God Mode</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Admin Control Center</p>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(({ path, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === path : location.pathname.startsWith(path) && path !== "/admin";
            const isOverview = path === "/admin" && location.pathname === "/admin";
            return (
              <Link
                key={path}
                to={path}
                data-testid={`admin-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active || isOverview
                    ? "bg-purple-600/20 text-purple-300"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-gray-950">
        {children}
      </main>
    </div>
  );
}
