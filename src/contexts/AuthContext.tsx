"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthContextType = {
  authLoading: boolean;
  userRole: string | null;
  isAdmin: boolean;
  userId: string | null;
};

const AuthContext = createContext<AuthContextType>({
  authLoading: true,
  userRole: null,
  isAdmin: false,
  userId: null,
});

async function loadProfileIntoState(session: Session): Promise<{
  role: string | null;
  userId: string;
}> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profileError && profile) {
    return { role: profile.role, userId: session.user.id };
  }
  return { role: null, userId: session.user.id };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const redirectLoginIfNeeded = () => {
      if (pathnameRef.current !== "/login") {
        routerRef.current.push("/login");
      }
    };

    const applyNoSession = () => {
      if (cancelled) return;
      setUserRole(null);
      setUserId(null);
      setAuthLoading(false);
      redirectLoginIfNeeded();
    };

    const applySession = async (session: Session) => {
      const { role, userId: uid } = await loadProfileIntoState(session);
      if (cancelled) return;
      setUserRole(role);
      setUserId(uid);
      setAuthLoading(false);
    };

    const handleAuthEvent = async (event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;

      try {
        if (!session) {
          applyNoSession();
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          if (!cancelled) setAuthLoading(false);
          return;
        }

        await applySession(session);
      } catch (err) {
        console.error("Erro inesperado na auth:", err);
        await supabase.auth.signOut();
        if (!cancelled) {
          setUserRole(null);
          setUserId(null);
          setAuthLoading(false);
          redirectLoginIfNeeded();
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthEvent(event, session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authLoading,
        userRole,
        isAdmin: userRole === "admin",
        userId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
