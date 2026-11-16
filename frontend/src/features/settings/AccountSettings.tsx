import { useAuth } from '../auth/useAuth';

import { CARD } from '../../components/styles';

export const AccountSettings = () => {
  const auth = useAuth();
  if (!auth.data?.loggedIn || auth.data.disabled) return null;
  const { name, email, permissions } = auth.data;

  return (
    <div className="max-w-2xl space-y-4">
      <section className={CARD}>
        <h2 className="text-base font-semibold">Your account</h2>
        <dl className="mt-3 space-y-3">
          <div><dt className="text-xs text-slate-500">Name</dt><dd className="mt-1 text-sm">{name}</dd></div>
          <div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 text-sm break-all">{email}</dd></div>
        </dl>
      </section>
      <section className={CARD}>
        <h2 className="text-base font-semibold">Your permissions</h2>
        {permissions?.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {permissions.map((permission) => (
              <li key={permission} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
                {permission}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No permissions assigned.</p>
        )}
      </section>
    </div>
  );
};
