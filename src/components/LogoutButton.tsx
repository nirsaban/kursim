'use client';

import { he } from '@/lib/he';
import { loginPathFor } from '@/lib/client/api';

export default function LogoutButton() {
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = loginPathFor(window.location.pathname);
  }
  return (
    <button onClick={logout} className="text-sm text-muted hover:text-ink transition-colors">
      {he.logout}
    </button>
  );
}
