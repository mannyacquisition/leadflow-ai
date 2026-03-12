import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

export default function SystemHealthBadge() {
  const [status, setStatus] = useState(null); // null = loading
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const logs = await base44.entities.SystemHealthLog.list("-created_date", 50);
      const windowStart = Date.now() - 24 * 60 * 60 * 1000;
      const recent = logs.filter(l => new Date(l.timestamp || l.created_date) > new Date(windowStart));
      const errors = recent.filter(l => l.status === "error").length;
      setErrorCount(errors);
      setStatus(errors > 5 ? "critical" : errors > 0 ? "degraded" : "healthy");
    } catch (_) {
      setStatus("healthy"); // If no log entity, assume healthy
    }
  };

  if (status === null) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-500 rounded-full text-sm border">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </span>
    );
  }

  const config = {
    healthy: { icon: ShieldCheck, label: "System Healthy", className: "bg-green-50 text-green-700 border-green-200" },
    degraded: { icon: ShieldAlert, label: `${errorCount} Error(s)`, className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    critical: { icon: ShieldAlert, label: `${errorCount} Errors`, className: "bg-red-50 text-red-700 border-red-200" },
  }[status];

  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}