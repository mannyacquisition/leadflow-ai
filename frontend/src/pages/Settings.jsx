import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings as SettingsIcon, Users, Building, User, Linkedin, Shield, CreditCard, Key, Mail } from "lucide-react";
import { toast } from "sonner";

const tabs = [
  { id: "organization", label: "Organization", icon: Users },
  { id: "company", label: "Company", icon: Building },
  { id: "account", label: "Account", icon: User },
  { id: "linkedin", label: "LinkedIn Accounts", icon: Linkedin },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "api", label: "API", icon: Key },
];

const mockMembers = [
  { id: "1", full_name: "Emmanuel Martinez", email: "emm22anuel@gmail.com", role: "owner", joined_date: "Feb 20, 2026, 03:28 PM" },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("organization");
  const [user, setUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [members, setMembers] = useState(mockMembers);
  const [settings, setSettings] = useState({ api_key_trigify: "", api_key_unipile: "", org_name: "" });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.OrganizationSettings.list().then(all => {
      if (all.length > 0) setSettings(all[0]);
    }).catch(() => {});
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    await base44.users.inviteUser(inviteEmail, "member");
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
  };

  const handleSaveApi = async () => {
    try {
      const all = await base44.entities.OrganizationSettings.list();
      if (all.length > 0) {
        await base44.entities.OrganizationSettings.update(all[0].id, settings);
      } else {
        await base44.entities.OrganizationSettings.create(settings);
      }
      toast.success("Settings saved!");
    } catch (e) {
      toast.error("Save failed");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-gray-500" />
          <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
        </div>
        <p className="text-sm text-gray-500">Manage your company information and profile settings</p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="px-6 bg-white border-b">
          <div className="flex gap-0.5">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-orange-500 text-orange-600 bg-orange-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {activeTab === "organization" && (
            <div className="max-w-3xl">
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {user?.full_name || "Your Organization"} – Members
                </h2>
                <p className="text-sm text-gray-500 mb-6">Manage who has access to your organization and their roles</p>

                <div className="mb-6">
                  <div className="text-sm font-medium text-gray-700 mb-2">Invite New Member</div>
                  <div className="flex gap-2">
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                    />
                    <button
                      onClick={handleInvite}
                      className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                      style={{ backgroundColor: "#ffb0a0", color: "#cc3300" }}
                    >
                      Invite
                    </button>
                  </div>
                </div>

                <table className="w-full">
                  <thead className="bg-gray-50 rounded-lg">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">MEMBER</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">ROLE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">JOINED</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {members.map(member => (
                      <tr key={member.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
                              {member.full_name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                              <div className="text-xs text-blue-500">{member.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            member.role === "owner"
                              ? "bg-yellow-100 text-yellow-700"
                              : member.role === "admin"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {member.role === "owner" ? "⚙ Owner" : member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{member.joined_date}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "api" && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
                <p className="text-sm text-gray-500">Connect your Trigify, Unipile, and Netrows accounts for signal discovery, outreach, and lead database access.</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trigify API Key</label>
                  <input
                    value={settings.api_key_trigify}
                    onChange={e => setSettings(s => ({ ...s, api_key_trigify: e.target.value }))}
                    placeholder="sk-trigify-..."
                    type="password"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unipile API Key</label>
                  <input
                    value={settings.api_key_unipile}
                    onChange={e => setSettings(s => ({ ...s, api_key_unipile: e.target.value }))}
                    placeholder="sk-unipile-..."
                    type="password"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Netrows API Key
                    <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full font-medium">Lead Database</span>
                  </label>
                  <input
                    value={settings.api_key_netrows || ""}
                    onChange={e => setSettings(s => ({ ...s, api_key_netrows: e.target.value }))}
                    placeholder="Your Netrows.com API key..."
                    type="password"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Get your key at <a href="https://netrows.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">netrows.com</a>. Enables searching 250M+ B2B contacts.</p>
                </div>

                <button
                  onClick={handleSaveApi}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: "#ff5a1f" }}
                >
                  Save API Keys
                </button>
              </div>
            </div>
          )}

          {activeTab === "linkedin" && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">LinkedIn Accounts</h2>
                <p className="text-sm text-gray-500 mb-6">Connect your LinkedIn accounts to enable automated outreach via Unipile.</p>
                <div className="border-2 border-dashed rounded-xl p-8 text-center">
                  <Linkedin className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">No LinkedIn account connected</p>
                  <p className="text-xs text-gray-400 mb-4">Connect via Unipile to enable automated invitations and messages</p>
                  <button className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                    Connect LinkedIn Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {(activeTab === "company" || activeTab === "account" || activeTab === "security" || activeTab === "billing") && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <SettingsIcon className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{tabs.find(t => t.id === activeTab)?.label}</h3>
                <p className="text-sm text-gray-400">This section is coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}