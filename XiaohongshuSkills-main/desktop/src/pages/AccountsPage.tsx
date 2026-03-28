import { useEffect, useState, useCallback } from "react";
import { api } from "@/services/api";
import { LoginPage } from "./LoginPage";
import {
  User,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  Loader2,
  MonitorSmartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Account {
  name: string;
  alias: string;
  is_default: boolean;
  profile_dir: string;
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAlias, setNewAlias] = useState("");
  const [showLogin, setShowLogin] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.listAccounts();
      setAccounts(res.accounts || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await api.addAccount(newName.trim(), newAlias.trim() || undefined);
      setShowAdd(false);
      setNewName("");
      setNewAlias("");
      await loadAccounts();
    } catch {}
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除账号「${name}」？`)) return;
    try {
      await api.deleteAccount(name);
      await loadAccounts();
    } catch {}
  };

  const handleSetDefault = async (name: string) => {
    try {
      await api.setDefaultAccount(name);
      await loadAccounts();
    } catch {}
  };

  if (showLogin) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-2">
          <button
            onClick={() => setShowLogin(false)}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            ← 返回账号列表
          </button>
        </div>
        <div className="flex-1">
          <LoginPage />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <User className="w-5 h-5 text-brand-500" />
            账号管理
          </h2>
          <p className="text-sm text-gray-500 mt-1">管理小红书账号与登录状态</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogin(true)}
            className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 flex items-center gap-1.5"
          >
            <MonitorSmartphone size={16} /> 扫码登录
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Plus size={16} /> 添加账号
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">添加新账号</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="账号标识（英文）"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="显示名称（可选）"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
            >
              确认
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>暂无账号</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.name}
              className={cn(
                "p-4 bg-white rounded-xl border flex items-center gap-4",
                acc.is_default ? "border-brand-300" : "border-gray-200"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                <User className="w-5 h-5 text-brand-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{acc.alias || acc.name}</span>
                  {acc.is_default && (
                    <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">
                      默认
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{acc.name}</p>
              </div>
              <div className="flex items-center gap-1">
                {!acc.is_default && (
                  <button
                    onClick={() => handleSetDefault(acc.name)}
                    title="设为默认"
                    className="p-2 text-gray-400 hover:text-brand-500 rounded-lg hover:bg-gray-50"
                  >
                    <Star size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(acc.name)}
                  title="删除"
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
