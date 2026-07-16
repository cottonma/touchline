/**
 * API client for communicating with the Touchline backend.
 * All API calls go through this module for consistency.
 * Includes Authorization header from stored token.
 */

const API_BASE = '/api';
const TOKEN_KEY = 'touchline_token';
const CLUB_KEY = 'touchline_active_club';

interface ApiError {
  error: string;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const activeClub = localStorage.getItem(CLUB_KEY);
    if (activeClub) {
      headers['X-Club-Id'] = activeClub;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    // Handle 401 — clear token and redirect to login
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('touchline_user');
      localStorage.removeItem('touchline_active_club');
      // Only redirect if not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.message || error.error);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE);
