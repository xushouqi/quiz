"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface User {
  id: number;
  name: string;
  emoji: string;
}

interface UserContextValue {
  /** Currently selected user (null = none selected / still loading). */
  currentUser: User | null;
  /** True while the initial user lookup is in flight. */
  loading: boolean;
  /** Switch to a different user by id. Clears user if id is null. */
  setCurrentUserId: (userId: number | null) => void;
  /** Full users list (populated lazily when a consumer reads it). */
  users: User[];
  /** Force a refresh of the users list from the API. */
  refreshUsersList: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

const STORAGE_KEY = "kangaroo-current-user";

function readStoredUserId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  const data = (await res.json()) as { users: User[] };
  return data.users;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  /** Track whether the users list has been fetched at least once. */
  const usersFetchedRef = useRef(false);

  /** Refresh the users list from the API. */
  const refreshUsersList = useCallback(async () => {
    try {
      const list = await fetchUsers();
      setUsers(list);
      usersFetchedRef.current = true;
    } catch {
      /* swallow - consumers can retry */
    }
  }, []);

  /** Switch to a different user by id. Also syncs localStorage. */
  const setCurrentUserId = useCallback(
    async (userId: number | null) => {
      if (userId === null) {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentUser(null);
        return;
      }
      // Ensure the users list is available so we can look up the user.
      let list = users;
      if (!usersFetchedRef.current) {
        try {
          list = await fetchUsers();
          setUsers(list);
          usersFetchedRef.current = true;
        } catch {
          return;
        }
      }
      const found = list.find((u) => u.id === userId) ?? null;
      if (found) {
        localStorage.setItem(STORAGE_KEY, String(userId));
        setCurrentUser(found);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentUser(null);
      }
    },
    [users],
  );

  // Initial load: resolve current user from localStorage + fetch users list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedId = readStoredUserId();
      try {
        const list = await fetchUsers();
        if (cancelled) return;
        setUsers(list);
        usersFetchedRef.current = true;
        if (storedId !== null) {
          const found = list.find((u) => u.id === storedId) ?? null;
          setCurrentUser(found);
        }
      } catch {
        /* server unreachable - leave state empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: UserContextValue = {
    currentUser,
    loading,
    setCurrentUserId,
    users,
    refreshUsersList,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}

/** Storage key is exposed so switchUser flows can clear it synchronously. */
export const USER_STORAGE_KEY = STORAGE_KEY;
