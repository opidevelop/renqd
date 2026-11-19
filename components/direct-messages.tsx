"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CornerUpLeft,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useConfirmDialog } from "@/components/confirm-dialog";

type Summary = {
  id: string;
  otherUserId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  otherReadAt: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

const QUICK_EMOJI = ["❤️", "😂", "👍", "😮"];

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DirectMessages({
  initialConversations,
  currentUserId,
  initialConversationId,
}: {
  initialConversations: Summary[];
  currentUserId: string;
  initialConversationId: string | null;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(initialConversationId));
  const { confirm, dialog } = useConfirmDialog();
  const active = conversations.find((item) => item.id === activeId) ?? null;

  const markRead = useCallback(async (conversationId: string) => {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error: readError } = await supabase
      .from("direct_conversation_reads")
      .upsert(
        { conversation_id: conversationId, user_id: currentUserId, last_read_at: now },
        { onConflict: "conversation_id,user_id" },
      );

    if (!readError) {
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      );
    }
  }, [currentUserId]);

  const loadReactions = useCallback(async (messageIds: string[]) => {
    if (!messageIds.length) {
      setReactions([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("direct_message_reactions")
      .select("id,message_id,user_id,emoji")
      .in("message_id", messageIds);
    setReactions((data ?? []) as Reaction[]);
  }, []);

  const loadMessages = useCallback(async (
    conversationId: string,
    otherUserId: string,
  ) => {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const [{ data, error: messageError }, { data: readRows }] = await Promise.all([
      supabase
        .from("direct_messages")
        .select("id,conversation_id,sender_id,body,reply_to_id,created_at,edited_at,deleted_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("direct_conversation_reads")
        .select("user_id,last_read_at")
        .eq("conversation_id", conversationId),
    ]);

    if (messageError) {
      setError(messageError.message);
    } else {
      const rows = (data ?? []) as Message[];
      setMessages(rows);
      await loadReactions(rows.map((row) => row.id));
    }

    setOtherReadAt(
      (readRows ?? []).find((row) => row.user_id === otherUserId)?.last_read_at ?? null,
    );
    setLoading(false);
    void markRead(conversationId);
  }, [loadReactions, markRead]);

  useEffect(() => {
    if (!activeId || !active) return;
    void loadMessages(activeId, active.otherUserId);

    const supabase = createClient();
    const channel = supabase
      .channel("dm-chat-" + activeId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: "conversation_id=eq." + activeId,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Message;
          if (payload.eventType === "INSERT") {
            setMessages((current) =>
              current.some((item) => item.id === row.id)
                ? current
                : [...current, row].sort((a, b) =>
                    a.created_at.localeCompare(b.created_at),
                  ),
            );
            if (row.sender_id !== currentUserId) void markRead(activeId);
          } else if (payload.eventType === "UPDATE") {
            setMessages((current) =>
              current.map((item) => (item.id === row.id ? row : item)),
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((current) => current.filter((item) => item.id !== row.id));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_message_reactions" },
        () => {
          void loadMessages(activeId, active.otherUserId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_conversation_reads",
          filter: "conversation_id=eq." + activeId,
        },
        (payload) => {
          const row = payload.new as { user_id?: string; last_read_at?: string };
          if (row.user_id === active.otherUserId) {
            setOtherReadAt(row.last_read_at ?? null);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    activeId,
    active?.otherUserId,
    currentUserId,
    loadMessages,
    loadReactions,
    markRead,
  ]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dm-inbox-" + currentUserId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_conversations" },
        () => {
          void (async () => {
            const { data } = await supabase
              .from("direct_conversations")
              .select("id,participant_one_id,participant_two_id,last_message_at,created_at")
              .or(
                "participant_one_id.eq." + currentUserId +
                ",participant_two_id.eq." + currentUserId,
              )
              .order("last_message_at", { ascending: false, nullsFirst: false });

            if (!data) return;
            setConversations((current) =>
              data.map((row) =>
                current.find((item) => item.id === row.id) ?? {
                  id: row.id,
                  otherUserId:
                    row.participant_one_id === currentUserId
                      ? row.participant_two_id
                      : row.participant_one_id,
                  username: null,
                  displayName: "Nuova conversazione",
                  avatarUrl: null,
                  isPrivate: true,
                  lastMessage: null,
                  unreadCount: 0,
                  otherReadAt: null,
                },
              ),
            );
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  async function sendMessage() {
    const body = draft.trim();
    if (!activeId || !body || sending) return;

    setSending(true);
    setError("");
    const supabase = createClient();
    const { error: sendError } = await supabase.from("direct_messages").insert({
      conversation_id: activeId,
      sender_id: currentUserId,
      body,
      reply_to_id: replyTo?.id ?? null,
    });

    if (sendError) {
      setError(sendError.message);
    } else {
      setDraft("");
      setReplyTo(null);
    }
    setSending(false);
  }

  async function saveEdit(message: Message) {
    const body = editDraft.trim();
    if (!body) {
      setError("Il messaggio non può essere vuoto.");
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("direct_messages")
      .update({ body })
      .eq("id", message.id);
    if (updateError) setError(updateError.message);
    else setEditing(null);
  }

  async function deleteMessage(message: Message) {
    const accepted = await confirm({
      title: "Eliminare il messaggio?",
      description: "Il messaggio verrà rimosso dalla conversazione per entrambi i partecipanti.",
      confirmLabel: "Elimina",
      tone: "danger",
    });
    if (!accepted) return;

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("direct_messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", message.id);
    if (deleteError) setError(deleteError.message);
  }

  async function toggleReaction(message: Message, emoji: string) {
    const supabase = createClient();
    const existing = reactions.find(
      (item) =>
        item.message_id === message.id &&
        item.user_id === currentUserId &&
        item.emoji === emoji,
    );

    if (existing) {
      const { error: deleteError } = await supabase
        .from("direct_message_reactions")
        .delete()
        .eq("id", existing.id);
      if (deleteError) setError(deleteError.message);
    } else {
      const { error: insertError } = await supabase
        .from("direct_message_reactions")
        .insert({ message_id: message.id, user_id: currentUserId, emoji });
      if (insertError) setError(insertError.message);
    }
    await loadReactions([message.id]);
  }

  function reactionSummary(messageId: string) {
    const rows = reactions.filter((item) => item.message_id === messageId);
    return QUICK_EMOJI
      .map((emoji) => ({
        emoji,
        count: rows.filter((row) => row.emoji === emoji).length,
        selected: rows.some(
          (row) => row.emoji === emoji && row.user_id === currentUserId,
        ),
      }))
      .filter((item) => item.count > 0);
  }

  const unreadTotal = conversations.reduce(
    (sum, item) => sum + item.unreadCount,
    0,
  );


  return (
    <div className={"dm-workspace" + (mobileChatOpen ? " is-chat-open" : "")}>
      <aside className="dm-conversation-list">
        <div className="dm-list-heading">
          <div>
            <span>CONVERSAZIONI PRIVATE</span>
            <h2>Messaggi</h2>
          </div>
          <strong>{unreadTotal || ""}</strong>
        </div>
        {conversations.length ? (
          conversations.map((item) => (
            <button
              type="button"
              key={item.id}
              className={"dm-conversation-item" + (activeId === item.id ? " is-active" : "")}
              onClick={() => {
                setActiveId(item.id);
                setMobileChatOpen(true);
              }}
            >
              <span className="dm-avatar">
                {item.avatarUrl
                  ? <img src={item.avatarUrl} alt="" />
                  : item.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="dm-conversation-copy">
                <strong>{item.displayName}</strong>
                <small>{item.lastMessage?.body ?? "Inizia la conversazione"}</small>
              </span>
              {item.unreadCount > 0 && <i>{item.unreadCount}</i>}
            </button>
          ))
        ) : (
          <div className="dm-empty-list">
            <MessageCircle size={24} />
            <strong>Nessuna conversazione</strong>
            <p>Quando accetterai o riceverai una richiesta, le chat compariranno qui.</p>
          </div>
        )}
      </aside>

      <section className="dm-chat-panel">
        {active ? (
          <>
            <header className="dm-chat-header">
              <button
                type="button"
                className="dm-mobile-back"
                onClick={() => setMobileChatOpen(false)}
                aria-label="Torna alle conversazioni"
              >
                <ArrowLeft size={18} />
              </button>
              <span className="dm-avatar">
                {active.avatarUrl
                  ? <img src={active.avatarUrl} alt="" />
                  : active.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{active.displayName}</strong>
                <small>{active.username ? "@" + active.username : "Conversazione privata"}</small>
              </div>
            </header>

            <div className="dm-message-list">
              {loading ? (
                <p className="dm-state">Caricamento messaggi…</p>
              ) : messages.length ? (
                messages.map((message) => {
                  const own = message.sender_id === currentUserId;
                  const reply = message.reply_to_id
                    ? messages.find((item) => item.id === message.reply_to_id)
                    : null;
                  const messageText = message.deleted_at
                    ? "Questo messaggio è stato eliminato"
                    : message.body;

                  return (
                    <article
                      key={message.id}
                      className={"dm-message" + (own ? " is-own" : "")}
                    >
                      <div className="dm-message-bubble">
                        {reply && (
                          <div className="dm-reply-context">
                            {reply.deleted_at ? "Messaggio eliminato" : reply.body}
                          </div>
                        )}
                        {editing === message.id ? (
                          <div className="dm-edit-inline">
                            <textarea
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                            />
                            <div>
                              <button type="button" onClick={() => setEditing(null)}>
                                Annulla
                              </button>
                              <button type="button" onClick={() => { void saveEdit(message); }}>
                                Salva
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p>{messageText}</p>
                        )}
                        <footer>
                          <time>{timeLabel(message.created_at)}</time>
                          {message.edited_at && !message.deleted_at && <span>Modificato</span>}
                          {own && (
                            <span>
                              {otherReadAt && otherReadAt >= message.created_at ? (
                                <><CheckCheck size={13} /> Letto</>
                              ) : (
                                <><Check size={13} /> Inviato</>
                              )}
                            </span>
                          )}
                        </footer>
                      </div>

                      <div className="dm-message-actions">
                        {!message.deleted_at && (
                          <>
                            <button
                              type="button"
                              title="Rispondi"
                              onClick={() => setReplyTo(message)}
                            >
                              <CornerUpLeft size={13} />
                            </button>
                            {QUICK_EMOJI.map((emoji) => (
                              <button
                                type="button"
                                key={emoji}
                                title={"Reagisci " + emoji}
                                onClick={() => { void toggleReaction(message, emoji); }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </>
                        )}
                        {own && !message.deleted_at && (
                          <>
                            <button
                              type="button"
                              title="Modifica"
                              onClick={() => {
                                setEditing(message.id);
                                setEditDraft(message.body);
                              }}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                            <button
                              type="button"
                              title="Elimina"
                              onClick={() => { void deleteMessage(message); }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>

                      {reactionSummary(message.id).length > 0 && (
                        <div className="dm-reactions">
                          {reactionSummary(message.id).map((item) => (
                            <button
                              type="button"
                              key={item.emoji}
                              className={item.selected ? "is-selected" : ""}
                              onClick={() => { void toggleReaction(message, item.emoji); }}
                            >
                              {item.emoji} {item.count}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="dm-state">
                  Questa conversazione è appena iniziata. Scrivi il primo messaggio.
                </p>
              )}
              {error && <p className="dm-error" role="alert">{error}</p>}
            </div>

            <form
              className="dm-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              {replyTo && (
                <div className="dm-reply-banner">
                  <span>Risposta a: {replyTo.body.slice(0, 100)}</span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    aria-label="Annulla risposta"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Scrivi un messaggio…"
                maxLength={4000}
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Invia messaggio">
                <Send size={17} />
              </button>
            </form>
          </>
        ) : (
          <div className="dm-no-chat">
            <MessageCircle size={34} />
            <strong>I tuoi messaggi, in privato.</strong>
            <p>Seleziona una conversazione per iniziare.</p>
          </div>
        )}
      </section>
      {dialog}
    </div>
  );
}
