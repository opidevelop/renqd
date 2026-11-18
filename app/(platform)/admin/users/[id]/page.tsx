import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Eye, FileText, FolderOpen, Heart, History, LockKeyhole, MessageCircle, ShieldCheck, UserRound, Users } from "lucide-react";
import { requireApprovedUser } from "@/lib/supabase/authorization";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";

export const dynamic = "force-dynamic";

type Account = {
  user_id: string; email: string; username: string; role: string; status: string;
  created_at: string; updated_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null;
};
type PublicProfile = {
  display_name: string | null; bio: string | null; avatar_url: string | null; banner_url: string | null;
  website_url: string | null; location: string | null; is_private: boolean; updated_at: string | null;
};
type Ranking = {
  id: string; title: string; public_slug: string | null; mode: string; status: string; visibility: string;
  created_at: string; completed_at: string | null; item_count: number; likes: number; comments: number;
};
type Collection = { id: string; title: string; slug: string; visibility: string; is_featured: boolean; created_at: string; item_count: number };
type HistoryItem = { id: string; action: string; old_value: string | null; new_value: string | null; reason: string | null; created_at: string; actor_username: string };
type Activity = { id: string; ranking_id: string; event_type: string; payload: Record<string, unknown> | null; created_at: string; ranking_title: string | null };
type UserDetail = {
  account: Account; profile: PublicProfile | null;
  stats: { rankings_total: number; rankings_published: number; rankings_drafts: number; likes_received: number; comments_received: number; followers: number; following: number; collections: number };
  rankings: Ranking[]; collections: Collection[]; account_history: HistoryItem[]; recent_activity: Activity[];
};

function date(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "long", year: "numeric" }).format(parsed);
}
function roleLabel(role: string) {
  return ({ OWNER: "Owner", ADMIN: "Admin", MODERATOR: "Moderatore", USER: "Utente" } as Record<string,string>)[role] ?? role;
}
function statusLabel(status: string) {
  return ({ APPROVED: "Approvato", PENDING: "In attesa", REJECTED: "Rifiutato", SUSPENDED: "Sospeso" } as Record<string,string>)[status] ?? status;
}
function modeLabel(mode: string) {
  return mode.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
}
function eventLabel(event: string) {
  const labels: Record<string,string> = {
    RANKING_CREATED: "Classifica creata", RANKING_COMPLETED: "Classifica completata",
    RANKING_PUBLISHED: "Classifica pubblicata", RANKING_UPDATED: "Classifica modificata",
    RANKING_DELETED: "Classifica eliminata", RANKING_LIKED: "Mi piace ricevuto",
    COMMENT_CREATED: "Commento ricevuto", RANKING_SHARED: "Classifica condivisa",
  };
  return labels[event] ?? event.replaceAll("_", " ").toLowerCase();
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, profile: actor } = await requireApprovedUser();
  if (actor.role !== "OWNER" && actor.role !== "ADMIN") redirect("/home");
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const { data, error } = await supabase.rpc("admin_get_user_detail", { p_target_user_id: id });
  if (error || !data) notFound();
  const detail = data as unknown as UserDetail;
  const { account, stats, rankings, collections, account_history: history, recent_activity: activity } = detail;
  const profile = detail.profile;
  const [avatarUrl, bannerUrl] = await Promise.all([
    getProfileMediaUrl(supabase, profile?.avatar_url ?? null),
    getProfileMediaUrl(supabase, profile?.banner_url ?? null),
  ]);

  return <div className="admin-page admin-user-detail-page">
    <Link href="/admin" className="admin-back-link"><ArrowLeft size={15}/> Torna alla gestione account</Link>
    <section className="admin-detail-hero">
      <div className="admin-detail-banner" style={bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(28,22,18,.58),rgba(28,22,18,.08)),url("${bannerUrl}")` } : undefined}>
        <div className="admin-detail-avatar" style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}>{!avatarUrl && <UserRound size={30}/>}</div>
        <div className="admin-detail-identity">
          <span className="admin-eyebrow">SCHEDA ACCOUNT</span>
          <h1>{profile?.display_name || account.username}</h1>
          <p>@{account.username} · {roleLabel(account.role)}</p>
        </div>
        <span className={"admin-status status-" + account.status.toLowerCase()}>{statusLabel(account.status)}</span>
      </div>
      <div className="admin-detail-contact">
        <div><span>Email</span><strong>{account.email}</strong><small className={account.email_confirmed_at ? "is-verified" : "is-unverified"}>{account.email_confirmed_at ? "Email verificata" : "Email non verificata"}</small></div>
        <div><span>Registrazione</span><strong>{date(account.created_at)}</strong><small>Ultimo accesso: {date(account.last_sign_in_at, true)}</small></div>
        <div><span>Profilo</span><strong>{profile?.is_private ? "Privato" : "Pubblico"}</strong><small>{profile?.location || "Località non indicata"}</small></div>
        {profile?.website_url && <a href={profile.website_url} target="_blank" rel="noreferrer"><span>Sito web</span><strong>{profile.website_url}</strong><ArrowUpRight size={14}/></a>}
      </div>
      {profile?.bio && <p className="admin-detail-bio">{profile.bio}</p>}
    </section>

    <section className="admin-detail-stats">
      <article><span><FileText size={16}/> Classifiche</span><strong>{stats.rankings_total}</strong><small>{stats.rankings_published} pubblicate · {stats.rankings_drafts} bozze</small></article>
      <article><span><Heart size={16}/> Mi piace ricevuti</span><strong>{stats.likes_received}</strong><small>Su tutte le classifiche</small></article>
      <article><span><MessageCircle size={16}/> Commenti</span><strong>{stats.comments_received}</strong><small>Commenti non eliminati</small></article>
      <article><span><Users size={16}/> Community</span><strong>{stats.followers}</strong><small>{stats.following} seguiti</small></article>
      <article><span><FolderOpen size={16}/> Raccolte</span><strong>{stats.collections}</strong><small>Raccolte create</small></article>
    </section>

    <section className="admin-detail-section">
      <div className="admin-section-heading"><div><span className="admin-eyebrow">CONTENUTI</span><h2>Classifiche <em>dell&apos;utente.</em></h2><p>Ultime 50 classifiche salvate e bozze.</p></div><span className="admin-total-pill">{rankings.length} elementi</span></div>
      {rankings.length === 0 ? <div className="admin-empty"><FileText size={22}/><strong>Nessuna classifica presente</strong><span>Questo account non ha ancora salvato classifiche.</span></div> : <div className="admin-detail-ranking-list">{rankings.map(item => <article key={item.id} className="admin-detail-ranking">
        <div className="admin-detail-ranking-icon"><FileText size={17}/></div>
        <div className="admin-detail-ranking-main"><strong>{item.title || "Senza titolo"}</strong><span>{modeLabel(item.mode)} · {item.item_count} elementi · {date(item.completed_at ?? item.created_at)}</span><small>{item.likes} mi piace · {item.comments} commenti</small></div>
        <div className="admin-detail-ranking-meta"><span className={"admin-status " + (item.status === "COMPLETED" ? "status-approved" : "status-pending")}>{item.status === "COMPLETED" ? "Completata" : "Bozza"}</span><span>{item.visibility === "LIVE" ? <><Eye size={12}/> Pubblica</> : <><LockKeyhole size={12}/> {item.visibility}</>}</span></div>
        {item.public_slug && <Link href={"/r/" + item.public_slug} className="admin-detail-open" aria-label={"Apri " + item.title}><ArrowUpRight size={16}/></Link>}
      </article>)}</div>}
    </section>

    <section className="admin-detail-section">
      <div className="admin-section-heading"><div><span className="admin-eyebrow">ORGANIZZAZIONE</span><h2>Raccolte <em>create.</em></h2></div><span className="admin-total-pill">{collections.length} raccolte</span></div>
      {collections.length === 0 ? <div className="admin-empty"><FolderOpen size={22}/><strong>Nessuna raccolta</strong><span>Non risultano raccolte create da questo account.</span></div> : <div className="admin-detail-collections">{collections.map(collection => <article key={collection.id}><div><FolderOpen size={17}/><strong>{collection.title}</strong></div><span>{collection.item_count} classifiche · {collection.visibility}{collection.is_featured ? " · In evidenza" : ""}</span><small>Creata il {date(collection.created_at)}</small></article>)}</div>}
    </section>

    <div className="admin-detail-columns">
      <section className="admin-detail-section">
        <div className="admin-section-heading"><div><span className="admin-eyebrow">SICUREZZA</span><h2>Storico <em>account.</em></h2><p>Modifiche amministrative.</p></div></div>
        {history.length === 0 ? <div className="admin-empty"><ShieldCheck size={22}/><strong>Nessuna modifica registrata</strong></div> : <div className="admin-detail-timeline">{history.map(item => <article key={item.id}><span className="admin-timeline-dot"><ShieldCheck size={13}/></span><div><strong>{item.action === "STATUS_CHANGED" ? "Modifica stato" : item.action === "ROLE_CHANGED" ? "Modifica ruolo" : item.action}</strong><time>{date(item.created_at,true)}</time><p>{item.old_value || "—"} → {item.new_value || "—"}</p><small>Da {item.actor_username}{item.reason ? " · " + item.reason : ""}</small></div></article>)}</div>}
      </section>
      <section className="admin-detail-section">
        <div className="admin-section-heading"><div><span className="admin-eyebrow">ATTIVITÀ</span><h2>Attività <em>recente.</em></h2><p>Ultimi eventi tracciati.</p></div></div>
        {activity.length === 0 ? <div className="admin-empty"><CalendarDays size={22}/><strong>Nessuna attività registrata</strong><span>Gli eventi compariranno quando saranno tracciati.</span></div> : <div className="admin-detail-timeline">{activity.map(item => <article key={item.id}><span className="admin-timeline-dot"><Clock3 size={13}/></span><div><strong>{eventLabel(item.event_type)}</strong><time>{date(item.created_at,true)}</time><p>{item.ranking_title || "Attività account"}</p></div></article>)}</div>}
      </section>
    </div>
  </div>;
}
