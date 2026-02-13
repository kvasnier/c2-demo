import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { API_BASE } from "../api";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type ChatAction = {
  type: string;
  payload: Record<string, unknown>;
};
type ChatResponse = { reply: string; actions?: ChatAction[] };
const COMINT_ANALYSIS_URL = "/media/airbushlt_rus_trs_trad.mkv";

const INITIAL_MESSAGES: ChatMsg[] = [
  { role: "assistant", content: "Chat C2 prêt. Dis-moi quoi faire (ex: “liste les drones dispo”)." },
];

export function ChatPanel({
  onActions,
  resetToken,
  onLinkClick,
}: {
  onActions: (a: ChatAction[]) => void;
  resetToken: number;
  onLinkClick?: (url: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    ...INITIAL_MESSAGES,
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setLoading(false);
  }, [resetToken]);

  async function send() {
    if (!canSend) return;
    const next = [...messages, { role: "user", content: input.trim() } as ChatMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const r = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as ChatResponse;

      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "(no text)" }]);
      const actions = data.actions ?? [];
      if (actions.length) onActions(actions);
    } catch (e) {
    const message =
        e instanceof Error ? e.message : "Erreur inconnue";

    setMessages((m) => [
        ...m,
        { role: "assistant", content: `Erreur chat: ${message}` },
    ]);
    } finally {
      setLoading(false);
    }
  }

  function renderMessageContent(content: string): ReactNode {
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|\b(intercept_communication)\b/g;
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;
    let key = 0;

    while ((match = linkPattern.exec(content)) !== null) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));

      const isMarkdownLink = Boolean(match[1] && match[2]);
      const label = isMarkdownLink ? match[1] : "intercept_communication";
      const url = isMarkdownLink ? match[2] : COMINT_ANALYSIS_URL;
      parts.push(
        <a
          key={`msg-link-${key++}`}
          href={url}
          onClick={(e) => {
            if (!onLinkClick) return;
            e.preventDefault();
            onLinkClick(url);
          }}
          target={onLinkClick ? undefined : "_blank"}
          rel={onLinkClick ? undefined : "noopener noreferrer"}
          style={{ color: "#8ac8ff", textDecoration: "underline" }}
        >
          {label}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    if (parts.length === 0) return content;
    if (lastIndex < content.length) parts.push(content.slice(lastIndex));
    return <>{parts}</>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: "1px solid #222" }}>
        <div style={{ fontWeight: 700 }}>C2 Chat</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Actions mockées → carte (bientôt)</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>
              {m.role === "user" ? "Vous" : m.role === "assistant" ? "Assistant" : "Système"}
            </div>
            <div
              style={{
                whiteSpace: "pre-wrap",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #222",
              }}
            >
              {renderMessageContent(m.content)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #222", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ex: “propose les drones dispo pour observer cette zone”"
          style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #222" }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #222" }}
        >
          {loading ? "..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
