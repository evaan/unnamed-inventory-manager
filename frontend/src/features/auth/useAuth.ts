import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authQueryKey, logout, whoAmI } from './auth';

export function useAuth() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: authQueryKey,
    queryFn: ({ signal }) => whoAmI(signal),
    retry: false,
  });

  useEffect(() => {
    if (query.data?.loggedIn && query.data.disabled && pathname !== '/disabled') {
      void navigate('/disabled', { replace: true });
    }
  }, [query.data, pathname, navigate]);

  return query;
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
  });
}
