import React from "react";
import ReactMarkdown from "react-markdown";
import { Bot } from "lucide-react";

const FireScore = ({ score }) => (
  <span>{[1, 2, 3].map(i => <span key={i} className={i <= score ? "" : "opacity-20"}>🔥</span>)}</span>
);

const LeadsTable = ({ leads }) => (
  <div className="mt-2 border rounded-lg overflow-hidden">
    <table className="w-full text-xs">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
          <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
          <th className="px-3 py-2 text-left font-medium text-gray-500">Score</th>
          <th className="px-3 py-2 text-left font-medium text-gray-500">Signal</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {(leads || []).map((lead, i) => (
          <tr key={i} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-medium">{lead.name}</td>
            <td className="px-3 py-2 text-gray-500">{lead.company}</td>
            <td className="px-3 py-2"><FireScore score={lead.ai_score || 2} /></td>
            <td className="px-3 py-2 text-gray-400">{lead.signal_source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function MonaraMessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 mt-0.5"
          style={{ backgroundColor: "#ff5a1f" }}>
          <Bot className="w-4 h-4" />
        </div>
      )}
      <div className={`max-w-2xl ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {isUser ? (
          <div className="bg-gray-800 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
            {message.content}
          </div>
        ) : (
          <div className="bg-white border rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
            <ReactMarkdown
              className="prose prose-sm max-w-none text-gray-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              components={{
                p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                li: ({ children }) => <li className="my-0.5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                code: ({ children }) => <code className="px-1 py-0.5 rounded bg-gray-100 text-xs font-mono">{children}</code>,
              }}
            >
              {message.content}
            </ReactMarkdown>

            {message.rich_type === "leads_table" && message.rich_data?.leads && (
              <LeadsTable leads={message.rich_data.leads} />
            )}

            {message.action_taken && (
              <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                ✅ {message.action_taken}
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-semibold flex-shrink-0 mt-0.5">
          U
        </div>
      )}
    </div>
  );
}