import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/api";
import { Loader2, CheckCircle2, RefreshCw, Smartphone } from "lucide-react";

type LoginState = "loading" | "qrcode" | "polling" | "success" | "error";

export function LoginPage() {
  const [state, setState] = useState<LoginState>("loading");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchQrCode = useCallback(async () => {
    setState("loading");
    setErrorMsg("");
    stopPolling();
    try {
      await api.chromeStart(false);
      const res = await api.loginQrcode();
      if (res.qrcode_data_url) {
        setQrDataUrl(res.qrcode_data_url);
        setState("qrcode");
        // Start polling login status
        setState("polling");
        pollRef.current = setInterval(async () => {
          try {
            const check = await api.loginCheck();
            if (check.logged_in) {
              stopPolling();
              setState("success");
            }
          } catch {}
        }, 3000);
      } else if (res.qrcode_base64) {
        setQrDataUrl(`data:image/png;base64,${res.qrcode_base64}`);
        setState("polling");
        pollRef.current = setInterval(async () => {
          try {
            const check = await api.loginCheck();
            if (check.logged_in) {
              stopPolling();
              setState("success");
            }
          } catch {}
        }, 3000);
      } else {
        // May already be logged in
        const check = await api.loginCheck();
        if (check.logged_in) {
          setState("success");
        } else {
          setState("error");
          setErrorMsg("无法获取登录二维码");
        }
      }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "获取二维码失败");
    }
  }, [stopPolling]);

  useEffect(() => {
    // Check if already logged in first
    api.loginCheck()
      .then((r) => {
        if (r.logged_in) setState("success");
        else fetchQrCode();
      })
      .catch(() => fetchQrCode());

    return stopPolling;
  }, [fetchQrCode, stopPolling]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-[420px] text-center">
        <Smartphone className="w-10 h-10 text-brand-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">登录小红书</h2>
        <p className="text-sm text-gray-500 mb-6">
          使用小红书 App 扫描下方二维码登录
        </p>

        {state === "loading" && (
          <div className="py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
            <p className="text-sm text-gray-400 mt-3">正在获取二维码...</p>
          </div>
        )}

        {(state === "qrcode" || state === "polling") && qrDataUrl && (
          <div>
            <div className="inline-block p-3 bg-white border border-gray-200 rounded-xl">
              <img src={qrDataUrl} alt="登录二维码" className="w-52 h-52" />
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              等待扫码确认...
            </p>
            <button
              onClick={fetchQrCode}
              className="mt-4 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 mx-auto"
            >
              <RefreshCw size={12} /> 刷新二维码
            </button>
          </div>
        )}

        {state === "success" && (
          <div className="py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-medium text-green-700 mt-3">登录成功</p>
            <p className="text-sm text-gray-500 mt-1">现在可以使用全部功能</p>
          </div>
        )}

        {state === "error" && (
          <div className="py-8">
            <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
            <button
              onClick={fetchQrCode}
              className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
