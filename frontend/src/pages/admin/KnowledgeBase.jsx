import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/client";
import { Upload, Globe, User, Trash2, File, Image, Video, FileText, Loader2, Tag, Search, BookOpen } from "lucide-react";
import { toast } from "sonner";

const FILE_ICONS = {
  pdf: <File className="w-4 h-4 text-red-400" />,
  image: <Image className="w-4 h-4 text-blue-400" />,
  video: <Video className="w-4 h-4 text-purple-400" />,
  text: <FileText className="w-4 h-4 text-gray-400" />,
};

const CHUNK_STATUS = (count) => {
  if (count === -1) return <span className="text-xs text-red-400">Embedding failed</span>;
  if (count === 0) return <span className="text-xs text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Embedding...</span>;
  return <span className="text-xs text-green-400">{count} chunks</span>;
};

export default function KnowledgeBase() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isGlobal, setIsGlobal] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const fileRef = useRef(null);

  const load = () => {
    setLoading(true);
    api.request("/admin/knowledge/files").then(data => {
      setFiles(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("is_global", isGlobal.toString());
    formData.append("tags", "[]");
    try {
      const token = localStorage.getItem("leadflow_token");
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${baseUrl}/api/admin/knowledge/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`Uploaded "${file.name}" — embedding in progress`);
      load();
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.request(`/admin/knowledge/files/${id}`, { method: "DELETE" });
    toast.success("File deleted");
    setFiles(f => f.filter(x => x.id !== id));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await api.request(
        `/admin/knowledge/search?query=${encodeURIComponent(searchQuery)}&top_k=5`,
        { method: "POST" }
      );
      setSearchResults(res.results);
    } catch {
      toast.error("Search failed");
    }
  };

  const filtered = files.filter(f => {
    if (filter === "global") return f.is_global;
    if (filter === "user") return !f.is_global;
    return true;
  });

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
          <p className="text-gray-400 text-sm mt-1">Multimodal RAG — PDF, images, video, text</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Scope:</span>
            <button
              onClick={() => setIsGlobal(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isGlobal ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              <Globe className="w-3 h-3 inline mr-1" />Global
            </button>
            <button
              onClick={() => setIsGlobal(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!isGlobal ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              <User className="w-3 h-3 inline mr-1" />User
            </button>
          </div>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading ? "bg-gray-700 text-gray-400" : "bg-purple-600 hover:bg-purple-700 text-white"}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Uploading..." : "Upload File"}
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={uploading}
              accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.doc,.docx" />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5 flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Semantic search across knowledge base..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium">
          Search
        </button>
        {searchResults && (
          <button onClick={() => setSearchResults(null)} className="px-3 py-2 bg-gray-800 text-gray-400 text-sm rounded-lg">
            Clear
          </button>
        )}
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="mb-5 bg-gray-900 rounded-xl border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-purple-300 mb-3">Search Results for "{searchQuery}"</h3>
          {searchResults.length === 0 ? (
            <p className="text-gray-500 text-sm">No results found.</p>
          ) : searchResults.map((r, i) => (
            <div key={i} className="mb-3 pb-3 border-b border-gray-800 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{r.file_name}</span>
                <span className="text-xs text-green-400">{(r.score * 100).toFixed(1)}% match</span>
              </div>
              <p className="text-sm text-gray-300 line-clamp-3">{r.chunk_text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {["all", "global", "user"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-lg capitalize font-medium transition-colors ${filter === f ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"}`}>
            {f === "all" ? "All Files" : f === "global" ? "Global KB" : "User KB"}
          </button>
        ))}
      </div>

      {/* Files Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-gray-500 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-700" />
            <p className="text-sm">No files yet. Upload a PDF, image, video, or text file.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">File</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Embeddings</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(f => (
                <tr key={f.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {FILE_ICONS[f.file_type] || FILE_ICONS.text}
                      <span className="text-gray-200 truncate max-w-xs">{f.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{f.file_type}</td>
                  <td className="px-4 py-3">
                    {f.is_global
                      ? <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded text-xs">Global</span>
                      : <span className="px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded text-xs">User</span>}
                  </td>
                  <td className="px-4 py-3">{CHUNK_STATUS(f.chunk_count)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(f.id, f.file_name)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

