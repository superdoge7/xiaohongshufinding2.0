import { NavLink } from "react-router-dom";
import {
  Search,
  BrainCircuit,
  FileText,
  Settings,
  User,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "首页" },
  { to: "/search", icon: Search, label: "搜索" },
  { to: "/ai", icon: BrainCircuit, label: "AI 工作台" },
  { to: "/reports", icon: FileText, label: "内容报告" },
  { to: "/accounts", icon: User, label: "账号管理" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export function Sidebar() {
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-gray-100">
        <h1 className="text-lg font-bold text-brand-600 tracking-tight">
          RedBook Desktop
        </h1>
        <p className="text-xs text-gray-400 mt-0.5">小红书内容分析工具</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )
            }
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
        v1.0.0
      </div>
    </aside>
  );
}
