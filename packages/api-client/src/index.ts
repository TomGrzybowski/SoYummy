export class ApiClient {
  constructor(private readonly baseUrl = '/api/v1') {}
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body === undefined || init.body instanceof FormData
          ? {}
          : { 'content-type': 'application/json' }),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message ?? 'Request failed');
    }
    return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
  }
  get<T>(path: string) {
    return this.request<T>(path);
  }
  post<T>(path: string, body?: unknown) {
    const init: RequestInit = { method: 'POST' };
    if (body !== undefined) init.body = body instanceof FormData ? body : JSON.stringify(body);
    return this.request<T>(path, init);
  }
  delete(path: string) {
    return this.request<void>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
