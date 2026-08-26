'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

type Props = {
  children: ReactNode;
  /** If set, user must have at least one of these roles */
  roles?: string[];
  /** Where to send unauthenticated users */
  loginHref?: string;
};

export function RequireAuth({
  children,
  roles,
  loginHref = '/login',
}: Props) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(pathname || '/');
      router.replace(`${loginHref}?next=${next}`);
      return;
    }
    if (roles?.length) {
      const ok = roles.some((r) => user?.roles?.includes(r));
      if (!ok) {
        router.replace('/');
      }
    }
  }, [loading, isAuthenticated, user, roles, router, pathname, loginHref]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray">
        در حال بارگذاری...
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (roles?.length && !roles.some((r) => user?.roles?.includes(r))) {
    return null;
  }

  return <>{children}</>;
}
