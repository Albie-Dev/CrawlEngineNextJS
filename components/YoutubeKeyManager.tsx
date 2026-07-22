"use client";

import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Check, AlertTriangle, Loader2, Eye, EyeOff, RefreshCw } from "lucide-react";

type KeyEntry = {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  exhaustedAt: number | null;
};

export function YoutubeKeyList() {
  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Load keys on mount
  useEffect(() => {
    fetch("/api/youtube/keys")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setKeys(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveKeys = async (updatedKeys: KeyEntry[]) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/youtube/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: updatedKeys }),
      });
      if (res.ok) {
        setKeys(updatedKeys);
        setStatus({ type: "success", msg: "Đã lưu" });
        setTimeout(() => setStatus(null), 2000);
      } else {
        setStatus({ type: "error", msg: "Lỗi khi lưu" });
      }
    } catch {
      setStatus({ type: "error", msg: "Lỗi kết nối" });
    } finally {
      setSaving(false);
    }
  };

  const addKey = () => {
    const trimmedKey = newKey.trim();
    const trimmedLabel = newLabel.trim() || `Key ${keys.length + 1}`;
    if (!trimmedKey) return;
    if (keys.some((k) => k.key === trimmedKey)) {
      setStatus({ type: "error", msg: "Key đã tồn tại" });
      return;
    }
    const entry: KeyEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      key: trimmedKey,
      label: trimmedLabel,
      isActive: true,
      exhaustedAt: null,
    };
    saveKeys([...keys, entry]);
    setNewKey("");
    setNewLabel("");
    setShowNewKey(false);
  };

  const removeKey = (id: string) => {
    saveKeys(keys.filter((k) => k.id !== id));
  };

  const toggleActive = (id: string) => {
    saveKeys(keys.map((k) => (k.id === id ? { ...k, isActive: !k.isActive } : k)));
  };

  const resetExhausted = (id: string) => {
    saveKeys(keys.map((k) => (k.id === id ? { ...k, exhaustedAt: null } : k)));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          YouTube API Keys
          <span className="ml-2 text-xs font-normal text-slate-400">({keys.length} key)</span>
        </p>
        {!showNewKey && (
          <button
            onClick={() => setShowNewKey(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-kolia-green px-3 py-1.5 text-[11px] font-bold text-white hover:bg-kolia-green/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm key
          </button>
        )}
      </div>

      {/* Form thêm key */}
      {showNewKey && (
        <div className="rounded-xl border border-borderColor bg-bgTertiary p-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">API Key</label>
            <div className="relative">
              <input
                type={showNewKey ? (showNewKey ? "text" : "password") : "password"}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg border border-borderColor bg-bgSecondary px-3 py-2 text-xs text-textPrimary placeholder-slate-400 focus:border-kolia-green focus:outline-none pr-8"
              />
              <button
                onClick={() => setShowNewKey(!showNewKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNewKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Ghi chú</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Key chính, Key dự phòng..."
              className="w-full rounded-lg border border-borderColor bg-bgSecondary px-3 py-2 text-xs text-textPrimary placeholder-slate-400 focus:border-kolia-green focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addKey}
              disabled={!newKey.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-kolia-green px-3 py-1.5 text-[11px] font-bold text-white hover:bg-kolia-green/90 disabled:opacity-50 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Thêm
            </button>
            <button
              onClick={() => { setShowNewKey(false); setNewKey(""); setNewLabel(""); }}
              className="rounded-lg border border-borderColor px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-bgTertiary transition-colors"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Danh sách key */}
      <div className="space-y-2">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
            <Key className="h-8 w-8 opacity-40" />
            <p className="text-xs">Chưa có YouTube API key nào.</p>
            <p className="text-[10px]">Thêm key để crawler và transcript hoạt động.</p>
          </div>
        ) : (
          keys.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                entry.isActive
                  ? "border-borderColor bg-bgSecondary"
                  : "border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10"
              }`}
            >
              {/* Status dot */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => toggleActive(entry.id)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    entry.isActive
                      ? entry.exhaustedAt
                        ? "bg-amber-400"
                        : "bg-kolia-green"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                  title={entry.isActive ? (entry.exhaustedAt ? "Đang tạm nghỉ (quota)" : "Đang hoạt động") : "Đã tắt"}
                />
                {entry.exhaustedAt && (
                  <button
                    onClick={() => resetExhausted(entry.id)}
                    className="text-[8px] text-amber-500 hover:text-amber-600"
                    title="Reset trạng thái exhausted"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>

              {/* Key info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-textPrimary truncate">
                  {entry.label}
                </p>
                <p className="text-[10px] font-mono text-textMuted truncate mt-0.5">
                  {entry.key.slice(0, 12)}...{entry.key.slice(-6)}
                </p>
              </div>

              {/* Actions */}
              <button
                onClick={() => removeKey(entry.id)}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Xoá key"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Status message */}
      {status && (
        <p className={`text-[11px] font-medium flex items-center gap-1 ${
          status.type === "success" ? "text-kolia-green" : "text-red-500"
        }`}>
          {status.type === "success" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {status.msg}
        </p>
      )}

      {saving && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Đang lưu...
        </p>
      )}
    </div>
  );
}
