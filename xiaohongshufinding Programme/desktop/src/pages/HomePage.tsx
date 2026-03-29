import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "@/store/AppContext";
import { api } from "@/services/api";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Search,
  BrainCircuit,
  FileText,
  Zap,
  AlertTriangle,
  RefreshCw,
  Play,
  Loader2,
} from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const { backendOk, chromeOk, loggedIn, refreshStatus } = useAppContext();
  const [browserStarting, setBrowserStarting] = useState(false);

  const handleStartBrowser = async () => {
    setBrowserStarting(true);
    try {
      await api.chromeStart(false);
    } catch {}
    await refreshStatus();
    setBrowserStarting(false);
  };

  const quickActions = [
    { icon: Search, label: "搜索笔记", desc: "按关键词搜索小红书内容", to: "/search" },
    { icon: BrainCircuit, label: "AI 分析", desc: "智能分析内容质量与爆款潜力", to: "/ai" },
    { icon: FileText, label: "内容报告", desc: "生成结构化分析报告", to: "/reports" },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">欢迎使用 RedBook Desktop</h1>
          <p className="text-gray-500 mt-1">小红书内容检索、AI 分析与报告生成工具</p>
        </div>
        <button
          onClick={() => refreshStatus()}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          title="刷新状态"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <StatusBadge
          status={backendOk === null ? "loading" : backendOk ? "ok" : "error"}
          label={backendOk === null ? "检查后端..." : backendOk ? "后端就绪" : "后端未启动"}
        />
        <StatusBadge
          status={chromeOk === null ? "loading" : chromeOk ? "ok" : "warning"}
          label={chromeOk === null ? "检查浏览器..." : chromeOk ? "浏览器运行中" : "浏览器未启动"}
        />
        <StatusBadge
          status={loggedIn === null ? "loading" : loggedIn ? "ok" : "warning"}
          label={loggedIn === null ? "检查登录..." : loggedIn ? "已登录" : "未登录"}
        />
      </div>

      {backendOk === false && (
        <div className="mb-8 p-5 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">后端服务未启动</p>
              <p className="text-xs text-red-600 mt-1 mb-3">
                所有功能依赖后端服务，请先在命令行中启动：
              </p>
              <div className="bg-white rounded-lg p-3 text-xs font-mono text-gray-700 space-y-1">
                <p className="text-gray-400"># 打开 CMD 或 PowerShell，进入项目目录后执行：</p>
                <p>python scripts/serve_local_app.py</p>
              </div>
              <button
                onClick={() => refreshStatus()}
                className="mt-3 text-xs font-medium text-red-700 hover:text-red-900 underline"
              >
                启动后点此刷新
              </button>
            </div>
          </div>
        </div>
      )}

      {backendOk && chromeOk === false && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">浏览器未启动</p>
              <p className="text-xs text-amber-600 mt-1">
                点击下方按钮启动浏览器，或前往「设置」页面选择浏览器
              </p>
              <button
                onClick={handleStartBrowser}
                disabled={browserStarting}
                className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {browserStarting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {browserStarting ? "启动中..." : "一键启动浏览器"}
              </button>
            </div>
          </div>
        </div>
      )}

      {backendOk && chromeOk && !loggedIn && loggedIn !== null && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">需要先登录小红书</p>
              <p className="text-xs text-amber-600 mt-1">
                前往「账号管理」页面，通过扫码或手机号登录后即可使用全部功能。
              </p>
              <button
                onClick={() => navigate("/accounts")}
                className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 underline"
              >
                前往登录
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {quickActions.map(({ icon: Icon, label, desc, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="p-5 bg-white rounded-xl border border-gray-200 text-left hover:shadow-md hover:border-brand-300 transition-all group"
          >
            <Icon className="w-8 h-8 text-brand-500 group-hover:text-brand-600 mb-3" />
            <h3 className="font-semibold text-gray-800">{label}</h3>
            <p className="text-xs text-gray-500 mt-1">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
