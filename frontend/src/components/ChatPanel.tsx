import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
type ChatAction = {
  type: string;
  payload: Record<string, unknown>;
};
type ChatResponse = { reply: string; actions?: ChatAction[] };

const INITIAL_MESSAGES: ChatMsg[] = [
  { role: "assistant", content: "Chat C2 prêt. Dis-moi quoi faire (ex: “liste les drones dispo”)." },
];

export function ChatPanel({
  onActions,
  resetToken,
}: {
  onActions: (a: ChatAction[]) => void;
  resetToken: number;
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
              {m.content}
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
