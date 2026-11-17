import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListSkeleton } from '../../components/ListSkeleton';
import { EmailDomainList } from './EmailDomainList';
import { getSettings, patchSettings, settingsQueryKey, type AppSettings as SettingsValues } from './settingsapi';
import { BUTTON, CARD, INPUT } from '../../components/styles';

const settingLabel = (name: string) => name === 'signup_policy' ? 'Automatically Disable New Users' : name.split('_')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const validate = (name: string, value: string): string | null => {
  if (name === 'signup_policy' && !['open', 'whitelist', 'closed'].includes(value)) {
    return 'Choose when to automatically disable new users.';
  }
  if (name === 'whitelisted_email_domains') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === 'string' && entry.trim() !== '')) {
        return 'The domain list could not be read. Reset the list before saving.';
      }
    } catch {
      return 'The domain list could not be read. Reset the list before saving.';
    }
  }
  return null;
};

const SettingField = ({ name, value, onChange, id }: {
  name: string; value: string; onChange: (value: string) => void; id: string;
}) => name === 'signup_policy' ? (
  <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>
    {!['open', 'whitelist', 'closed'].includes(value) && <option value={value}>{value}</option>}
    <option value="open">Never</option>
    <option value="whitelist">When their email domain is not whitelisted</option>
    <option value="closed">Always</option>
  </select>
) : name === 'whitelisted_email_domains' ? (
  <EmailDomainList id={id} value={value} onChange={onChange} />
) : (
  <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={2} className={INPUT} />
);

const SettingEditor = ({ name, value }: { name: string; value: string }) => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(value);
  const [validationError, setValidationError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => patchSettings({ [name]: draft }),
    onSuccess: () => {
      queryClient.setQueryData<SettingsValues>(settingsQueryKey, (settings) => ({ ...settings, [name]: draft }));
    },
  });
  const description = name === 'signup_policy'
    ? 'Choose when new accounts start disabled and need an administrator to enable them. Existing accounts are not affected.'
    : name === 'whitelisted_email_domains'
      ? 'New users with these email domains stay enabled when automatic disabling is based on their domain. Save your changes after adding or removing domains.'
      : 'Stored as a string. Encode lists or objects as JSON if the consuming feature expects them.';

  return (
    <form
      className={CARD}
      aria-label={`Edit ${settingLabel(name)}`}
      onSubmit={(event) => {
        event.preventDefault();
        const error = validate(name, draft);
        setValidationError(error);
        if (!error && draft !== value && !save.isPending) save.mutate();
      }}
    >
      <label htmlFor={`setting-${name}`} className="block text-sm font-medium break-all">
        {settingLabel(name)}
      </label>
      <p className="mt-1 mb-4 text-xs text-slate-500">{description}</p>
      <fieldset disabled={save.isPending}>
        <SettingField
          id={`setting-${name}`}
          name={name}
          value={draft}
          onChange={(next) => { setDraft(next); setValidationError(null); save.reset(); }}
        />
        <button type="submit" disabled={draft === value} className={`${BUTTON} mt-3`}>
          {save.isPending ? 'Saving…' : 'Save setting'}
        </button>
      </fieldset>
      {(validationError || save.error) && <p role="alert" className="mt-3 text-sm text-rose-300">{validationError ?? save.error?.message}</p>}
      {save.isSuccess && <p role="status" className="mt-3 text-sm text-emerald-300">Setting saved.</p>}
    </form>
  );
};

export const AppSettings = () => {
  const settings = useQuery({
    queryKey: settingsQueryKey,
    queryFn: ({ signal }) => getSettings(signal),
    retry: false,
  });
  if (settings.isPending) return <ListSkeleton label="Loading app settings" />;
  if (settings.isError) return (
    <div role="alert" className={CARD}>
      <p className="text-sm text-rose-300">{settings.error.message}</p>
      <button className={`${BUTTON} mt-3`} onClick={() => void settings.refetch()}>Try again</button>
    </div>
  );

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <div>
        <h2 className="text-base font-semibold">App settings</h2>
        <p className="mt-1 text-sm text-slate-400">Global configuration shared by everyone.</p>
      </div>
      {Object.entries(settings.data).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => (
        <SettingEditor key={name} name={name} value={value} />
      ))}
      {Object.keys(settings.data).length === 0 && <p className="text-sm text-slate-500">No settings yet.</p>}
    </section>
  );
};
