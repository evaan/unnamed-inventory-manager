import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { BUTTON, INPUT } from '../../components/styles';

const parseDomains = (value: string): string[] | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((domain) => typeof domain === 'string' && domain.trim() !== '')
      ? parsed : null;
  } catch {
    return null;
  }
};

const isDomain = (domain: string) => {
  const labels = domain.split('.');
  return domain.length <= 253 && labels.length > 1 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    /^[a-z]/.test(labels[labels.length - 1]);
};

export const EmailDomainList = ({ id, value, onChange }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const domains = parseDomains(value);

  const add = () => {
    const domain = input.trim().toLowerCase();
    if (!domains) return;
    if (!isDomain(domain)) {
      setError('Enter a valid domain, such as example.com, without an email address or website URL.');
      return;
    }
    if (domains.some((existing) => existing.trim().toLowerCase() === domain)) {
      setError('This domain is already on the list.');
      return;
    }
    onChange(JSON.stringify([...domains, domain]));
    setInput('');
    setError('');
  };

  if (!domains) return (
    <div>
      <p role="alert" className="text-sm text-rose-300">The saved domain list could not be read. Reset it to enter domains again.</p>
      <button type="button" onClick={() => onChange('[]')} className={`${BUTTON} mt-3`}>Reset domain list</button>
    </div>
  );

  return (
    <div>
      {domains.length > 0 ? (
        <ul aria-label="Approved email domains" className="mb-3 divide-y divide-slate-800 rounded-lg border border-slate-800">
          {domains.map((domain, index) => (
            <li key={`${domain}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 break-all text-sm">{domain}</span>
              <button
                type="button"
                aria-label={`Remove domain ${domain}`}
                onClick={() => {
                  onChange(JSON.stringify(domains.filter((_, position) => position !== index)));
                  setError('');
                }}
                className="ui-icon-button hover:!text-rose-300"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mb-3 text-sm text-slate-500">No email domains added.</p>}
      <div className="flex items-start gap-2">
        <input
          id={id}
          value={input}
          placeholder="e.g. example.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => { setInput(event.target.value); setError(''); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          className={INPUT}
        />
        <button type="button" onClick={add} disabled={!input.trim()} className={`${BUTTON} flex shrink-0 items-center gap-1.5`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add domain
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
};
