const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

const API_BASE =
  (import.meta.env.DEV && isLocalHost())
    ? (import.meta.env.VITE_API_BASE || 'https://bypass-lime.vercel.app')
    : (import.meta.env.VITE_API_BASE || '');

const buildUrl = (path: string) => {
  const trimmedBase = API_BASE.replace(/\/$/, '');
  const trimmedPath = path.replace(/^\//, '');
  return `${trimmedBase}/api/${trimmedPath}`;
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Sincronizar dados com Neon (assíncrono, sem bloquear UX)
export async function syncToNeon(action: string, data: any): Promise<void> {
  try {
    await apiPost('sync', { action, data });
    console.log(`✅ Sincronizado: ${action}`);
  } catch (err) {
    console.warn(`⚠️ Erro ao sincronizar ${action}:`, err);
    // Não lança erro; permite que app continue funcionando offline
  }
}

