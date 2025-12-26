export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`/api/${path}`, {
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

