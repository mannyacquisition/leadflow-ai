import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Shield, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

export default function SystemHealthBadge() {
  const [status, setStatus] = useState(null); // null = loading

  useEffect(() => {
    api.health().then(() => setStatus("healthy")).catch(() => setStatus("degraded"));
  }, []);

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
    degraded: { icon: ShieldAlert, label: "Service Issue", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  }[status] || { icon: ShieldCheck, label: "System Healthy", className: "bg-green-50 text-green-700 border-green-200" };

  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}