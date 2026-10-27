import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function RouteScroll() {
  const location = useLocation();
  const action = useNavigationType();
  useEffect(() => {
    if (!location.hash && (action === 'POP' || location.state?.saarthiNavigation)) return;
    const frame = requestAnimationFrame(() => {
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      const top = target ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88) : 0;
      window.scrollTo({ top, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash, location.state, action]);
  return null;
}
