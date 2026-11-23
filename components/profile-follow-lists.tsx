'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { Users, X, UserRound, ArrowUpRight } from 'lucide-react';

type FollowProfile = { userId: string; username: string | null; displayName: string; avatarUrl: string | null };
type FollowKind = 'followers' | 'following';

export function ProfileFollowLists({
  followerCount,
  followingCount,
  followers,
  following,
  variant = 'inline',
  showFollowers = true,
  showFollowing = true,
}: {
  followerCount: number;
  followingCount: number;
  followers: FollowProfile[];
  following: FollowProfile[];
  variant?: 'inline' | 'stat';
  showFollowers?: boolean;
  showFollowing?: boolean;
}) {
  const [open, setOpen] = useState<FollowKind | null>(null);
  const entries = open === 'followers' ? followers : following;
  const title = open === 'followers' ? 'I tuoi follower' : 'I profili che segui';

  function openList(kind: FollowKind, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollContainer = event.currentTarget.closest('.platform-content') as HTMLElement | null;
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetTop = scrollContainer.scrollTop + rect.top - containerRect.top - Math.min(260, scrollContainer.clientHeight * 0.32);
      scrollContainer.scrollTo(0, Math.max(0, targetTop));
    } else {
      const targetTop = window.scrollY + rect.top - Math.min(260, window.innerHeight * 0.32);
      window.scrollTo(0, Math.max(0, targetTop));
    }
    setOpen(kind);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const scrollContainer = document.querySelector('.platform-content') as HTMLElement | null;
    const previousContainerOverflow = scrollContainer?.style.overflowY ?? '';
    document.body.style.overflow = 'hidden';
    if (scrollContainer) scrollContainer.style.overflowY = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      if (scrollContainer) scrollContainer.style.overflowY = previousContainerOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <>
      {variant === 'stat' ? (
        showFollowing && (
          <button type='button' className='profile-follow-stat' onClick={(event) => openList('following', event)} aria-label={followingCount + ' profili seguiti. Apri la lista.'}>
            <strong>{followingCount}</strong>
            <span>FOLLOWING</span>
            <UserRound size={15} aria-hidden='true' />
          </button>
        )
      ) : (
        <div className='profile-follow-lists'>
          {showFollowers && <button type='button' onClick={(event) => openList('followers', event)}><Users size={14} /><strong>{followerCount}</strong> Follower</button>}
          {showFollowing && <button type='button' onClick={(event) => openList('following', event)}><UserRound size={14} /><strong>{followingCount}</strong> Seguiti</button>}
        </div>
      )}

      {open && (
        <div className='profile-follow-modal-backdrop' onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(null); }}>
          <section className='profile-follow-modal' role='dialog' aria-modal='true' aria-labelledby='profile-follow-modal-title'>
            <header>
              <div><span>LA TUA COMMUNITY</span><h2 id='profile-follow-modal-title'>{title}</h2></div>
              <button type='button' aria-label='Chiudi' onClick={() => setOpen(null)}><X size={18} /></button>
            </header>
            <div className='profile-follow-modal-list'>
              {entries.length ? entries.map((entry) => (
                <div className='profile-follow-modal-entry' key={entry.userId}>
                  <span className='profile-follow-modal-avatar'>
                    {entry.avatarUrl ? <img src={entry.avatarUrl} alt='' /> : <b>{entry.username ? entry.displayName.slice(0, 1).toUpperCase() : <UserRound size={17} />}</b>}
                  </span>
                  <span className='profile-follow-modal-copy'>
                    <strong>{entry.displayName}</strong>
                    {entry.username && <small>@{entry.username}</small>}
                    {!entry.username && <small>Informazioni non visibili</small>}
                  </span>
                  {entry.username && <Link href={'/u/' + entry.username} onClick={() => setOpen(null)} aria-label={'Apri il profilo di ' + entry.username}><ArrowUpRight size={16} /></Link>}
                </div>
              )) : <div className='profile-follow-modal-empty'>Ancora nessun profilo in questa lista.</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
