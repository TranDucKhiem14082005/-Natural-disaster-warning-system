const BASE = '/api/v1';
const TOKEN_KEY = 'dw_token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode): session-only login
  }
}

type QueryValue = string | number | boolean | null | undefined | (string | number)[];
// `object` so interfaces such as LatLng can be passed directly.
type Query = object;

export function toQuery(params: Query = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, QueryValue][]) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(`${key}[]`, String(v)));
    else search.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(BASE + path + toQuery(query), { method, headers, body: payload });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const message =
      res.status === 429 ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' : data.message || `Lỗi ${res.status}`;
    throw new ApiError(res.status, message, data.errors);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const first = Object.values(err.errors)[0]?.[0];
    return first ?? err.message;
  }
  return err instanceof Error ? err.message : 'Đã có lỗi xảy ra.';
}
