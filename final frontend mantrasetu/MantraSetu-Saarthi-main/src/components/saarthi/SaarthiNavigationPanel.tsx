import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { normalizeNavigationTarget, resolveNavigationMessage, type Destination } from '@/lib/conversation-navigation';
import { canGoBack, recordNavigation, type NavigationHistory } from '@/lib/navigation-history';
import { useAuth } from '@/contexts/AuthContext';
import './navigation-panel.css';

type Message = { role: 'user' | 'assistant'; text: string };
type Props = { open: boolean; onOpen: () => void; onClose: () => void; voiceError: string | null; voiceReady: boolean };

export function SaarthiNavigationPanel({ open, onOpen, onClose, voiceError, voiceReady }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { isAuthenticated } = useAuth();
  const currentPath = location.pathname + location.search + location.hash;
  const history = useRef<NavigationHistory>({ entries: [{ key: location.key, path: currentPath }], index: 0 });
  const requestedScroll = useRef(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Destination[]>([]);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: 'Namaste! Kaunsa page kholun? “Puja dikhao”, “Kundali banao” ya “Pandit registration” likhiye. Hindi mein bhi likh sakte hain.' }]);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history.current = recordNavigation(history.current, { key: location.key, path: currentPath }, navigationType);
    if (!requestedScroll.current) return;
    requestedScroll.current = false;
    const section = location.hash.slice(1);
    const frame = requestAnimationFrame(() => {
      const anchors: Record<string, string> = {
        '/puja': '#puja-catalog-section', '/kundali-creation': '#kundali-form-section',
        '/muhurat-finder': '#muhurat-finder-section', '/login': '[data-testid="card-login"]',
        '/signup': '[data-testid="card-signup"]', '/sign-up': '[data-testid="card-signup"]',
      };
      const target = section ? document.getElementById(section) : document.querySelector(anchors[location.pathname] || 'main');
      const top = target && (location.pathname !== '/' || section)
        ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88) : 0;
      window.scrollTo({ top, behavior: 'smooth' });
      if (window.matchMedia('(max-width: 640px)').matches) {
        onClose();
        if (target instanceof HTMLElement) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [currentPath, location.hash, location.pathname, location.key, navigationType, onClose]);

  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, open]);

  function close() { onClose(); requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true })); }
  function navigateTo(path: string) {
    const destination = path === '/dashboard' && !isAuthenticated ? '/login' : path;
    requestedScroll.current = true;
    navigate(destination, { replace: destination === currentPath, state: { saarthiNavigation: true } });
    return destination;
  }
  function send(message: string) {
    const text = message.trim().slice(0, 500);
    if (!text) return;
    const reply = resolveNavigationMessage(text, pending);
    let response = reply.text;
    if (reply.kind === 'navigate' && reply.destination) {
      const path = normalizeNavigationTarget(reply.destination.path);
      if (path) {
        const actualPath = navigateTo(path);
        if (path === '/dashboard' && actualPath === '/login') response = 'Account dekhne ke liye pehle sign in kijiye. Login page khol diya.';
      }
    } else if (reply.kind === 'back') {
      if (canGoBack(history.current)) {
        requestedScroll.current = true;
        navigate(-1);
      } else response = 'Is session mein abhi koi pichhla page nahi hai. Kaunsa page kholun?';
    }
    setPending(reply.choices || []);
    setMessages(previous => [...previous, { role: 'user' as const, text }, { role: 'assistant' as const, text: response }].slice(-24));
    setDraft('');
    input.current?.focus({ preventScroll: true });
  }

  return <>
    {!open && <button ref={launcher} className="saarthi-nav-launcher" type="button" onClick={onOpen}
      aria-label="Saarthi se likhkar baat karein" aria-expanded={false} aria-controls="saarthi-navigation-panel">
      <MessageCircle size={19} /> <span>Saarthi se baat karein</span>
    </button>}
    {open && <section id="saarthi-navigation-panel" className="saarthi-nav-panel" aria-label="Saarthi page assistant"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <header className="saarthi-nav-header"><div><strong>Saarthi</strong><p>Likhkar page kholen · Hindi / Hinglish / English</p></div>
        <button type="button" onClick={close} aria-label="Close Saarthi conversation"><X size={20} /></button>
      </header>
      <p className="saarthi-nav-note">Yahan page navigation hota hai. Booking aur form submit aap khud karenge.</p>
      {voiceError && !voiceReady && <p className="saarthi-nav-voice-status" role="status">AI voice abhi connect nahi ho paaya. Likhkar pages khol sakte hain.</p>}
      <div ref={log} className="saarthi-nav-log" role="log" aria-label="Saarthi conversation" aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => <p className={`saarthi-nav-message ${message.role}`} key={index}>
          <span className="saarthi-nav-sr">{message.role === 'user' ? 'Aap: ' : 'Saarthi: '}</span>{message.text}
        </p>)}
      </div>
      <div className="saarthi-nav-choices" aria-label="Page choices">
        {(pending.length ? pending : [{ path: '/puja', label: 'Puja' }, { path: '/kundali-creation', label: 'Kundali' }, { path: '/muhurat-finder', label: 'Muhurat' }]).map(choice =>
          <button type="button" key={choice.path} onClick={() => {
            // Resolve the exact offered option instead of reinterpreting its label.
            const result = normalizeNavigationTarget(choice.path);
            if (!result) return;
            navigateTo(result); setPending([]);
            setMessages(previous => [...previous, { role: 'user' as const, text: choice.label }, { role: 'assistant' as const, text: `${choice.label} khol diya.` }].slice(-24));
          }}>{choice.label}</button>)}
      </div>
      <button type="button" className="saarthi-nav-view-page" onClick={close}>Page dekhein · chat band karein</button>
      <form className="saarthi-nav-form" onSubmit={event => { event.preventDefault(); send(draft); }}>
        <label className="saarthi-nav-sr" htmlFor="saarthi-navigation-message">Saarthi ko message</label>
        <input ref={input} id="saarthi-navigation-message" name="navigation-message" value={draft}
          onChange={event => setDraft(event.target.value)} maxLength={500} autoComplete="off"
          placeholder="Jaise: mujhe Kundali banwani hai" />
        <button type="submit" disabled={!draft.trim()} aria-label="Send Saarthi message"><Send size={19} /></button>
      </form>
    </section>}
  </>;
}
