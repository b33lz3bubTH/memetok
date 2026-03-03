import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { superAdminApi, SuperAdminApiKey, SuperAdminUploader } from '@/lib/api';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState('');
  const [email, setEmail] = useState('');
  const [keyName, setKeyName] = useState('default');
  const [uploaders, setUploaders] = useState<SuperAdminUploader[]>([]);
  const [apiKeys, setApiKeys] = useState<SuperAdminApiKey[]>([]);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!adminKey.trim()) return;
    try {
      setError(null);
      const [uploaderRes, keysRes] = await Promise.all([
        superAdminApi.listUploaders(adminKey.trim()),
        superAdminApi.listApiKeys(adminKey.trim()),
      ]);
      setUploaders(uploaderRes.items);
      setApiKeys(keysRes.items);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    loadData();
  }, [adminKey]);

  const onAddUploader = async () => {
    try {
      await superAdminApi.addUploader(adminKey.trim(), email.trim());
      setEmail('');
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onCreateApiKey = async () => {
    try {
      const result = await superAdminApi.createApiKey(adminKey.trim(), keyName.trim());
      setNewApiKey(result.apiKey);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await superAdminApi.revokeApiKey(adminKey.trim(), id);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/70 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to feed
        </button>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Super Admin Panel</h1>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter super admin API key"
            className="w-full rounded-md bg-black/30 border border-white/20 px-3 py-2"
          />
          {error && <p className="text-red-300 text-sm">{error}</p>}
        </div>

        <div className="glass rounded-2xl p-6 space-y-3">
          <h2 className="font-medium">Add uploader email</h2>
          <div className="flex gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="uploader@company.com" className="flex-1 rounded-md bg-black/30 border border-white/20 px-3 py-2" />
            <button onClick={onAddUploader} className="px-4 py-2 rounded-md bg-white text-black">Add</button>
          </div>
          <ul className="text-sm text-white/80 space-y-1">
            {uploaders.map((u) => <li key={u.id}>{u.email} {u.userId ? `• ${u.userId}` : ''}</li>)}
          </ul>
        </div>

        <div className="glass rounded-2xl p-6 space-y-3">
          <h2 className="font-medium">API Keys</h2>
          <div className="flex gap-2">
            <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name" className="flex-1 rounded-md bg-black/30 border border-white/20 px-3 py-2" />
            <button onClick={onCreateApiKey} className="px-4 py-2 rounded-md bg-white text-black">Generate</button>
          </div>
          {newApiKey && <p className="text-emerald-300 text-sm">New API key (save now): <code>{newApiKey}</code></p>}
          <ul className="space-y-2 text-sm">
            {apiKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between bg-black/20 rounded-md px-3 py-2">
                <span>{k.name} {k.revokedAt ? '(revoked)' : ''}</span>
                {!k.revokedAt && <button onClick={() => onRevoke(k.id)} className="text-red-300">Revoke</button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
