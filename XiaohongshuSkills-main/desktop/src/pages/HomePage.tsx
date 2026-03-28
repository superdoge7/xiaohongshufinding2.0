import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, BrainCircuit, FileText, Zap } from "lucide-react";

export function HomePage() {
  const navigate = useNavigate();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [chromeOk, setChromeOk] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    api.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false));
    api.chromeStatus().then((r) => setChromeOk(r.running)).catch(() => setChromeOk(false));
    api.loginCheck().then((r) => setLoggedIn(r.logged_in)).catch(() => setLoggedIn(false));
  }, []);

  const quickActions = [
    { icon: Search, label: "搜索笔记", desc: "按关键词搜索小红书内容", to: "/search" },
    { icon: BrainCircuit, label: "AI 分析", desc: "智能分析内容质量与爆款潜力", to: "/ai" },
    { icon: FileText, label: "内容报告", desc: "生成结构化分析报告", to: "/reports" },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          欢迎使用 RedBook Desktop
        </h1>
        <p className="text-gray-500 mt-1">
          小红书内容检索、AI 分析与报告生成工具
        </p>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <StatusBadge
          status={backendOk === null ? "loading" : backendOk ? "ok" : "error"}
          label={backendOk === null ? "检查后端..." : backendOk ? "后端就绪" : "后端未启动"}
        />
        <StatusBadge
          status={chromeOk === null ? "loading" : chromeOk ? "ok" : "warning"}
          label={chromeOk === null ? "检查 Chrome..." : chromeOk ? "Chrome 运行中" : "Chrome 未启动"}
        />
        <StatusBadge
          status={loggedIn === null ? "loading" : loggedIn ? "ok" : "warning"}
          label={loggedIn === null ? "检查登录..." : loggedIn ? "已登录" : "未登录"}
        />
      </div>

      {!loggedIn && loggedIn !== null && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">需要先登录小红书</p>
              <p className="text-xs text-amber-600 mt-1">
                前往「账号管理」页面扫码登录后即可使用全部功能。
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
