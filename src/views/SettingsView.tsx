import React, { useState } from 'react';
import {
  Settings,
  Fuel,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Globe,
  Wifi,
} from 'lucide-react';
import { inrToPaise, formatINR } from '../utils/format';
import { getApiBaseUrl, setApiBaseUrl, isCapacitor } from '../utils/apiConfig';

interface SettingsViewProps {
  settings: Record<string, string>;
  onRefreshData: () => void;
  onLoadDemo: () => Promise<void>;
  onResetApp: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshData,
  onLoadDemo,
  onResetApp,
}) => {
  const [allowOverdraft, setAllowOverdraft] = useState(settings.allow_overdraft === 'true');

  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Backup restore
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // Server connection (for Android APK & external backend)
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl() || (isCapacitor() ? 'https://ais-pre-77bhmhkxvu52nopsk7bxom-844589323095.asia-northeast1.run.app' : ''));
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionMessage(null);
    try {
      const target = serverUrl.trim().replace(/\/$/, '');
      const healthUrl = target ? `${target}/api/health` : '/api/health';
      const res = await fetch(healthUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConnectionMessage({ type: 'success', text: `Connected! Server status: ${data.status || 'online'}` });
    } catch (err: any) {
      setConnectionMessage({ type: 'error', text: `Connection failed: ${err.message || 'Host unreachable'}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveServerUrl = () => {
    setApiBaseUrl(serverUrl.trim());
    setConnectionMessage({ type: 'success', text: 'Server endpoint updated successfully.' });
    onRefreshData();
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setSavedSuccess(false);

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'allow_overdraft', value: String(allowOverdraft) }),
      });

      setSavedSuccess(true);
      onRefreshData();
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportBackup = () => {
    fetch('/api/export/backup')
      .then(res => res.json())
      .then(data => {
        const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', jsonStr);
        dlAnchor.setAttribute('download', `rupee_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
      });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        setImporting(true);
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/import/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to restore backup');

        setImportSuccess(true);
        onRefreshData();
        setTimeout(() => setImportSuccess(false), 4000);
      } catch (err: any) {
        setError(err.message || 'Corrupted backup file');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await onResetApp();
      setShowResetConfirm(false);
      onRefreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-[#111318] tracking-tight">
          Settings & Financial Controls
        </h2>
        <p className="text-xs sm:text-sm text-[#6B7280]">
          Manage budget limits, overdraft safety policies, and database backups
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] text-xs font-semibold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>Financial rules and preferences successfully saved!</span>
        </div>
      )}

      {importSuccess && (
        <div className="p-3.5 bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] text-xs font-semibold rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>Backup restored successfully! All accounts and ledgers updated.</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-medium">
          {error}
        </div>
      )}

      {/* Financial Rules Form */}
      <form onSubmit={handleSavePreferences} className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-7 shadow-xs space-y-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Financial Safety Policies
        </h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="overdraftToggle"
              checked={allowOverdraft}
              onChange={e => setAllowOverdraft(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-[#065F46] focus:ring-[#065F46] border-[#D1D5DB] cursor-pointer"
            />
            <div>
              <label htmlFor="overdraftToggle" className="text-xs font-bold text-[#111318] cursor-pointer">
                Allow Negative Balances (Account Overdraft)
              </label>
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                When disabled, the app displays an immediate confirmation dialog before allowing any expense or transfer that exceeds an account&apos;s available money.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={savingSettings}
            className="px-5 py-2.5 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {savingSettings ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Mobile App & Server Connection */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#065F46]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Android & API Server Connection
              </h3>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              The backend server URL used by the Android APK to access your SQLite database and persistent transactions.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#F8F9FA] text-[#717680] border border-[#EAEBED] self-start sm:self-auto">
            {isCapacitor() ? 'Android Native APK' : 'Web App Mode'}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#111318] mb-1.5">
              Backend Server Endpoint (HTTPS)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="https://..."
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-[#EAEBED] bg-white text-[#111318] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#065F46]/20 focus:border-[#065F46]"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 bg-[#F8F9FA] hover:bg-[#EAEBED] border border-[#EAEBED] text-[#111318] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5 text-[#065F46]" />
                <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="px-4 py-2 bg-[#065F46] hover:bg-[#047857] text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
              >
                Save Server URL
              </button>
            </div>
          </div>

          {connectionMessage && (
            <div
              className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
                connectionMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-[#065F46]'
                  : 'bg-rose-50 border-rose-200 text-[#DC2626]'
              }`}
            >
              {connectionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{connectionMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Database Backup & Restore */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
            Database Backup & Portability
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Your data is stored in a persistent SQLite database. Export snapshots or restore backups anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={handleExportBackup}
            className="p-4 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-[#111318] font-bold text-xs mb-1">
              <Download className="w-4 h-4 text-[#065F46]" />
              <span>Export Complete JSON Backup</span>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              Download complete accounts, transactions, petrol logs, and budgets.
            </p>
          </button>

          <label className="p-4 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl text-left transition-all cursor-pointer group">
            <div className="flex items-center gap-2 text-[#111318] font-bold text-xs mb-1">
              <Upload className="w-4 h-4 text-[#4B5563]" />
              <span>{importing ? 'Restoring...' : 'Restore Database from JSON'}</span>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              Restore an existing backup JSON file into the local database.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Reset & Demo Scenario */}
      <div className="bg-white rounded-3xl border border-[#EAEBED] p-6 sm:p-7 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Demo Data & Factory Reset
        </h3>

        <div className="space-y-3">
          <div className="p-4 bg-[#FAF7F2] border border-[#EFE8DC] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[#854D0E] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#B45309]" />
                Student Demo Scenario
              </h4>
              <p className="text-[11px] text-[#713F12] mt-0.5">
                Loads the student scenario: ₹5,000 IT income allocated between College Petrol (₹2,000) and Personal Spending (₹3,000), petrol refuels, personal expenses, and allocation closeouts to Savings.
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadDemo}
              className="px-4 py-2 bg-[#B45309] hover:bg-[#92400E] text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              Load Student Scenario
            </button>
          </div>

          <div className="p-4 bg-rose-50/60 border border-rose-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Factory Clean Reset
              </h4>
              <p className="text-[11px] text-rose-800 mt-0.5">
                Clears all transactions and initializes the College Petrol and Personal Spending accounts with clean ₹0 balances.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
            >
              Reset to Clean State
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#EAEBED] space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-[#111318]">Confirm Factory Reset</h3>
            </div>
            <p className="text-xs text-[#4B5563] leading-relaxed">
              Are you sure you want to reset the application? All recorded transactions and custom accounts will be removed. The College Petrol and Personal Spending accounts will be reset to ₹0 balances, and Savings records will be cleared.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-[#4B5563] hover:text-[#111318] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={resetting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
