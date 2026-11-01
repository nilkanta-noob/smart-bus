import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const bootstrapStarted = useRef(false);
  const hadGuestSession = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const guestBootstrap = trpc.auth.guestBootstrap.useMutation({
    onSuccess: async (user) => { utils.auth.me.setData(undefined, user); await utils.auth.me.invalidate(); },
  });

  useEffect(() => {
    if (meQuery.data) { hadGuestSession.current = true; return; }
    if (!meQuery.isSuccess || (bootstrapStarted.current && !hadGuestSession.current)) return;
    bootstrapStarted.current = true;
    hadGuestSession.current = false;
    guestBootstrap.mutate();
  }, [meQuery.isSuccess, meQuery.data, guestBootstrap]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || guestBootstrap.isPending,
      error: meQuery.error ?? guestBootstrap.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    guestBootstrap.error,
    guestBootstrap.isPending,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
  };
}
