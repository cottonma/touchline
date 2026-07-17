import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from './api';

/**
 * User data returned from the auth API.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  clubIds: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  activeClubId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setActiveClubId: (clubId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'touchline_token';
const USER_KEY = 'touchline_user';
const CLUB_KEY = 'touchline_active_club';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [activeClubId, setActiveClubIdState] = useState<string | null>(
    () => localStorage.getItem(CLUB_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setActiveClubIdState(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CLUB_KEY);
  }, []);

  const setActiveClubId = useCallback((clubId: string) => {
    setActiveClubIdState(clubId);
    localStorage.setItem(CLUB_KEY, clubId);
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Verify token is still valid — but don't log out on failure if we have cached user data
    api.get<AuthUser>('/auth/me')
      .then((userData) => {
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        if (!activeClubId && userData.clubIds.length > 0) {
          setActiveClubId(userData.clubIds[0]);
        }
      })
      .catch(() => {
        // If we have cached user data, keep it (token might be temporarily failing)
        const cached = localStorage.getItem(USER_KEY);
        if (!cached) {
          logout();
        }
        // Otherwise just continue with cached user data
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const response = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    });

    setToken(response.token);
    setUser(response.user);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));

    // Set active club
    if (response.user.clubIds.length > 0) {
      setActiveClubId(response.user.clubIds[0]);
    }
  };

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    isLoading,
    activeClubId,
    login,
    logout,
    setActiveClubId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
