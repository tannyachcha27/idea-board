'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Idea } from '@/lib/types';

function Arrow({check = false}: {check?: boolean}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{check ? <path d="m5 12 4 4L19 6"/> : <path d="m6 14 6-6 6 6"/>}</svg>;
}
function Spark({small = false}: {small?: boolean}) {
  return <svg width={small ? 22 : 30} height={small ? 22 : 30} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 2 3.6 10.4L30 16l-10.4 3.6L16 30l-3.6-10.4L2 16l10.4-3.6L16 2Z" fill="currentColor"/></svg>;
}
function relativeDate(date: string) {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(date))/86400000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : new Date(date).toLocaleDateString(undefined, {month:'short', day:'numeric'});
}
export default function Board() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [sort, setSort] = useState<'top'|'new'>('top');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const requestNumber = useRef(0);
  const load = useCallback(async (offset = 0) => {
    const number = ++requestNumber.current;
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/ideas?sort=${sort}&offset=${offset}`, {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load ideas.');
      if (number !== requestNumber.current) return;
      setIdeas(previous => offset ? [...previous, ...data.ideas.filter((i: Idea) => !previous.some(p => p.id === i.id))] : data.ideas);
      setHasMore(data.hasMore);
    } catch (err) { if (number === requestNumber.current) setError(err instanceof Error ? err.message : 'Could not load ideas.'); }
    finally { if (number === requestNumber.current) setLoading(false); }
  }, [sort]);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setFormError(''); setNotice('');
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/ideas', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(Object.fromEntries(values))});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not share your idea.');
      form.current?.reset(); setDescription('');
      setNotice('Your idea is on the board. Thanks for sharing a spark!');
      if (sort !== 'new') setSort('new'); else await load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not share your idea.'); }
    finally { setSubmitting(false); }
  }
  async function vote(idea: Idea) {
    if (voting.has(idea.id) || idea.voted) return;
    setVoting(current => new Set(current).add(idea.id)); setNotice('');
    try {
      const response = await fetch('/api/votes', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({idea_id:idea.id})});
      const data = await response.json();
      if (response.status === 409) {
        setIdeas(current => current.map(i => i.id === idea.id ? {...i, voted:true} : i));
        setNotice('You have already voted for this idea.');
      } else if (!response.ok) throw new Error(data.error || 'Could not save your vote.');
      else {
        setIdeas(current => current.map(i => i.id === idea.id ? {...i, voted:true, vote_count:i.vote_count+1} : i));
        setNotice('Vote counted. Good ideas grow together.');
      }
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Could not save your vote.'); }
    finally { setVoting(current => {const next = new Set(current); next.delete(idea.id); return next;}); }
  }
  function focusForm() {
    document.getElementById('share')?.scrollIntoView({behavior:'smooth', block:'start'});
    titleInput.current?.focus({preventScroll:true});
  }
  return <>
    <header className="header"><div className="header-inner"><a className="brand" href="/" aria-label="Idea Board home"><span className="brand-icon"><Spark small /></span>idea board<span className="brand-dot">.</span></a><div className="header-right"><span className="community-label"><span className="status-dot"/> A space for everyone</span><button className="button button-small" onClick={focusForm}>Share an idea <span aria-hidden="true">↗</span></button></div></div></header>
    <main className="shell">
      <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow"><span className="tiny-line"/> SMALL SPARKS. BIG POSSIBILITIES.</p><h1 id="hero-title">Good things start<br/>with <span>an idea.</span><span className="hero-spark"><Spark /></span></h1><p className="hero-description">A shared space for your “what ifs.” Drop an idea,<br className="desktop-break"/> lift up your favorites, and help shape what’s next.</p><div className="hero-note"><span className="mini-avatars" aria-hidden="true"><i>T</i><i>J</i><i>M</i></span><span>Every voice has a place here.</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="art-plus plus-one">+</span><span className="art-plus plus-two">✦</span><div className="paper paper-back"><span className="paper-label">a fresh perspective</span><div className="fake-line"/><div className="fake-line short"/></div><div className="paper paper-front"><span className="paper-pin"/><span className="paper-label">what if we...</span><p>made something<br/>great, together?</p><div className="paper-bottom"><span className="paper-heart">♡</span><span>one little spark</span><span>↗</span></div></div><span className="art-caption">Room for your next big thought.</span></div></section>
      <div className="board-layout"><section className="ideas-section" aria-labelledby="board-title"><div className="section-top"><div><p className="eyebrow subtle">THE COMMUNITY BOARD</p><h2 id="board-title">A little inspiration, right here<span className="title-dot">.</span></h2></div></div><div className="board-toolbar"><div className="tabs" aria-label="Sort ideas"><button aria-pressed={sort === 'top'} className={sort === 'top' ? 'active' : ''} onClick={() => setSort('top')}><span aria-hidden="true">↗</span> Top ideas</button><button aria-pressed={sort === 'new'} className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}><span aria-hidden="true">◷</span> Newest</button></div><button className="refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh ideas">↻ <span>Refresh</span></button></div>
      <div className="announcement" role="status" aria-live="polite">{notice}</div>
      {error ? <div className="empty error-box" role="alert"><h3>We couldn’t load the board.</h3><p>{error}</p><button className="text-button" onClick={() => void load()}>Try again →</button></div> : <>
      {loading && !ideas.length ? <div className="skeletons" aria-label="Loading ideas" aria-busy="true">{[1,2,3].map(n => <div key={n} className="skeleton"><div/><div/><div/></div>)}</div> : !ideas.length ? <div className="empty"><span className="empty-spark"><Spark/></span><h3>Big possibilities. A blank canvas.</h3><p>Be the first to share a thought.<br/>Your little spark could start something great.</p><button className="text-button" onClick={focusForm}>Put the first idea on the board <span aria-hidden="true">↗</span></button></div> : <div className="idea-list">{ideas.map((idea, index) => <article className="idea-card" key={idea.id}><button className={`vote-button ${idea.voted ? 'voted' : ''}`} disabled={idea.voted || voting.has(idea.id)} onClick={() => void vote(idea)} aria-label={`${idea.voted ? 'Already voted for' : 'Vote for'} ${idea.title}, ${idea.vote_count} votes`} aria-pressed={idea.voted}><Arrow check={idea.voted}/><strong>{idea.vote_count}</strong></button><div className="idea-content"><div className="idea-heading"><h3>{idea.title}</h3>{sort === 'top' && index === 0 && idea.vote_count > 0 && <span className="top-badge">COMMUNITY FAVORITE</span>}</div><p className="idea-description">{idea.description}</p><div className="idea-meta"><span className={`avatar avatar-${index%3}`}>{idea.author_nickname.slice(0,1).toUpperCase()}</span><span>{idea.author_nickname}</span><span className="meta-dot">·</span><time dateTime={idea.created_at}>{relativeDate(idea.created_at)}</time></div></div></article>)}</div>}
      {hasMore && <button className="load-more" disabled={loading} onClick={() => void load(ideas.length)}>{loading ? 'Loading…' : 'More good ideas ↓'}</button>}
      </>}
      <p className="board-footnote"><span aria-hidden="true">↟</span> See something you love? Give it a little lift.</p></section>
      <aside className="share-column"><section className="share-card" id="share" aria-labelledby="share-title"><div className="share-icon"><Spark small/></div><h2 id="share-title">Got a little spark?</h2><p className="share-intro">We’d love to hear it. No sign-up,<br/>just an idea and a name.</p><form ref={form} onSubmit={submit}><label htmlFor="idea-title">Your idea<span>*</span></label><input ref={titleInput} id="idea-title" name="title" placeholder="What if we…" required minLength={3} maxLength={100}/><div className="label-row"><label htmlFor="description">Tell us a little more<span>*</span></label><span>{description.length}/1000</span></div><textarea id="description" name="description" placeholder="What’s the idea? Why would it be great?" required minLength={10} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} rows={5}/><label htmlFor="nickname">Your nickname<span>*</span></label><input id="nickname" name="author_nickname" placeholder="How should we call you?" required minLength={2} maxLength={30} autoComplete="nickname"/><p className="nickname-note">A first name or a fun alias. You do you.</p>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="button submit-button" type="submit" disabled={submitting}>{submitting ? 'Sharing your idea…' : 'Share your idea'}<span aria-hidden="true">↗</span></button><p className="form-footer">Small ideas welcome. Big dreams, too.</p></form></section><div className="kind-note"><span aria-hidden="true">☀</span><div><strong>A little kindness goes a long way.</strong><p>Keep it thoughtful. Keep it constructive.<br/>This space is better with you in it.</p></div></div></aside></div>
    </main><footer className="footer"><a className="footer-brand" href="/">idea board.</a><span>Made for good ideas and the people behind them.</span><span className="footer-right">No accounts. Just possibilities.</span></footer>
  </>;
}
