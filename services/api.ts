const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

// Em dev local, usar same-origin ("/api") por padrão.
// Se VITE_API_BASE estiver definido, respeitar.
const API_BASE = (() => {
  const envBase = import.meta.env.VITE_API_BASE;
  if (envBase !== undefined) return envBase;
  // Dev local: same-origin
  if (import.meta.env.DEV && isLocalHost()) return '';
  // Prod/vercel: same-origin (functions sob /api)
  return '';
})();

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

export async function apiPut<T>(path: string, body: any): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete<T>(path: string, query?: any): Promise<T> {
  const url = query ? `${buildUrl(path)}?${new URLSearchParams(query).toString()}` : buildUrl(path);
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" }
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

