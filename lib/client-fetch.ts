// fetch para el navegador: si la sesión venció, manda al login.

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const next = window.location.pathname + window.location.search;
    // Recarga completa para que el proxy muestre el login.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }
  return res;
}

export async function readError(res: Response, fallback = "No se pudo completar la consulta."): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}
