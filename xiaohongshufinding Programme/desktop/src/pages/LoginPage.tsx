import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/services/api";
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  Phone,
  QrCode,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

type LoginMode = "qrcode" | "phone";
type LoginState =
  | "checking"
  | "loading"
  | "qrcode"
  | "polling"
  | "success"
  | "error"
  | "backend_down"
  | "browser_down"
  | "phone_input"
  | "phone_code_sent"
  | "phone_verifying";

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("qrcode");
  const [state, setState] = useState<LoginState>("checking");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Phone login state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkBackendAndBrowser = useCallback(async (): Promise<boolean> => {
    try {
      await api.health();
    } catch {
      setState("backend_down");
      return false;
    }
    try {
      const s = await api.chromeStatus();
      if (!s.running) {
        setState("browser_down");
        return false;
      }
    } catch {
      setState("browser_down");
      return false;
    }
    return true;
  }, []);

  const fetchQrCode = useCallback(async () => {
    setState("loading");
    setErrorMsg("");
    stopPolling();
    if (!(await checkBackendAndBrowser())) return;
    try {
      const res = await api.loginQrcode();
      const dataUrl =
        res.qrcode_data_url ||
        (res.qrcode_base64
          ? `data:image/png;base64,${res.qrcode_base64}`
          : "");
      if (dataUrl) {
        setQrDataUrl(dataUrl);
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
        const check = await api.loginCheck();
        if (check.logged_in) {
          setState("success");
        } else {
          setState("error");
          setErrorMsg("无法获取登录二维码，请确保浏览器已正常打开小红书页面");
        }
      }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "获取二维码失败");
    }
  }, [stopPolling, checkBackendAndBrowser]);

  const handlePhoneSend = useCallback(async () => {
    if (!phoneNumber.trim() || phoneNumber.trim().length < 11) {
      setErrorMsg("请输入有效的手机号码");
      return;
    }
    setPhoneSending(true);
    setErrorMsg("");
    if (!(await checkBackendAndBrowser())) {
      setPhoneSending(false);
      return;
    }
    try {
      const res = await api.loginPhoneStart(phoneNumber.trim());
      if (res.already_logged_in) {
        setState("success");
      } else if (res.ok) {
        setState("phone_code_sent");
      } else {
        setErrorMsg(res.reason || "发送验证码失败");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "发送验证码失败");
    }
    setPhoneSending(false);
  }, [phoneNumber, checkBackendAndBrowser]);

  const handlePhoneVerify = useCallback(async () => {
    if (!smsCode.trim()) return;
    setState("phone_verifying");
    setErrorMsg("");
    try {
      const res = await api.loginPhoneVerify(phoneNumber.trim(), smsCode.trim());
      if (res.logged_in) {
        setState("success");
      } else {
        setState("phone_code_sent");
        setErrorMsg("登录未成功，请检查验证码是否正确");
      }
    } catch (e) {
      setState("phone_code_sent");
      setErrorMsg(e instanceof Error ? e.message : "验证失败");
    }
  }, [phoneNumber, smsCode]);

  useEffect(() => {
    (async () => {
      try {
        await api.health();
      } catch {
        setState("backend_down");
        return;
      }
      try {
        const s = await api.chromeStatus();
        if (!s.running) {
          setState("browser_down");
          return;
        }
      } catch {
        setState("browser_down");
        return;
      }
      try {
        const r = await api.loginCheck();
        if (r.logged_in) {
          setState("success");
          return;
        }
      } catch {}
      if (mode === "qrcode") fetchQrCode();
      else setState("phone_input");
    })();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchMode = (m: LoginMode) => {
    stopPolling();
    setErrorMsg("");
    setMode(m);
    if (m === "qrcode") fetchQrCode();
    else setState("phone_input");
  };

  const handleStartBrowser = async () => {
    setState("loading");
    try {
      const res = await api.chromeStart(false);
      if (res.ok) {
        if (mode === "qrcode") fetchQrCode();
        else setState("phone_input");
      } else {
        setState("error");
        setErrorMsg("浏览器启动失败");
      }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "浏览器启动失败");
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-[440px] text-center">
        <Smartphone className="w-10 h-10 text-brand-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">登录小红书</h2>

        {/* Backend down */}
        {state === "backend_down" && (
          <div className="py-8">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-amber-800 mb-2">后端服务未启动</p>
            <div className="text-xs text-gray-500 text-left bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p>请在命令行中启动后端：</p>
              <code className="block bg-gray-100 p-2 rounded text-xs font-mono">
                python scripts/serve_local_app.py
              </code>
            </div>
            <button
              onClick={() => {
                setState("checking");
                checkBackendAndBrowser().then((ok) => {
                  if (ok) {
                    if (mode === "qrcode") fetchQrCode();
                    else setState("phone_input");
                  }
                });
              }}
              className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
            >
              重新检测
            </button>
          </div>
        )}

        {/* Browser down */}
        {state === "browser_down" && (
          <div className="py-8">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-amber-800 mb-2">浏览器未启动</p>
            <p className="text-xs text-gray-500 mb-4">
              需要启动 Chrome 或 Edge 浏览器才能登录
            </p>
            <button
              onClick={handleStartBrowser}
              className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
            >
              一键启动浏览器
            </button>
          </div>
        )}

        {/* Checking */}
        {state === "checking" && (
          <div className="py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
            <p className="text-sm text-gray-400 mt-3">正在检查连接状态...</p>
          </div>
        )}

        {/* Mode switcher (only when neither backend_down nor browser_down nor success) */}
        {!["backend_down", "browser_down", "success", "checking"].includes(state) && (
          <>
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => switchMode("qrcode")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-colors ${
                  mode === "qrcode"
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <QrCode size={15} /> 扫码登录
              </button>
              <button
                onClick={() => switchMode("phone")}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border transition-colors ${
                  mode === "phone"
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Phone size={15} /> 手机号登录
              </button>
            </div>

            {/* QR code loading */}
            {mode === "qrcode" && state === "loading" && (
              <div className="py-12">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
                <p className="text-sm text-gray-400 mt-3">正在获取二维码...</p>
              </div>
            )}

            {/* QR code display */}
            {mode === "qrcode" &&
              (state === "qrcode" || state === "polling") &&
              qrDataUrl && (
                <div>
                  <div className="inline-block p-3 bg-white border border-gray-200 rounded-xl">
                    <img
                      src={qrDataUrl}
                      alt="登录二维码"
                      className="w-52 h-52"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    使用小红书 App 扫码，等待确认...
                  </p>
                  <button
                    onClick={fetchQrCode}
                    className="mt-4 text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw size={12} /> 刷新二维码
                  </button>
                </div>
              )}

            {/* Phone input */}
            {mode === "phone" && state === "phone_input" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  输入手机号获取短信验证码
                </p>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="请输入手机号"
                  maxLength={11}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
                {errorMsg && (
                  <p className="text-xs text-red-500">{errorMsg}</p>
                )}
                <button
                  onClick={handlePhoneSend}
                  disabled={phoneSending || phoneNumber.trim().length < 11}
                  className="w-full px-4 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {phoneSending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  {phoneSending ? "发送中..." : "获取验证码"}
                </button>
              </div>
            )}

            {/* Phone code sent */}
            {mode === "phone" &&
              (state === "phone_code_sent" || state === "phone_verifying") && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    验证码已发送至 <span className="font-medium">{phoneNumber}</span>
                  </p>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) =>
                      setSmsCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="输入验证码"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  {errorMsg && (
                    <p className="text-xs text-red-500">{errorMsg}</p>
                  )}
                  <button
                    onClick={handlePhoneVerify}
                    disabled={
                      state === "phone_verifying" || smsCode.length < 4
                    }
                    className="w-full px-4 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {state === "phone_verifying" ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    {state === "phone_verifying" ? "验证中..." : "确认登录"}
                  </button>
                  <button
                    onClick={() => {
                      setSmsCode("");
                      setErrorMsg("");
                      setState("phone_input");
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    重新输入手机号
                  </button>
                </div>
              )}

            {/* Error */}
            {state === "error" && (
              <div className="py-6">
                <p className="text-sm text-red-600 mb-4">{errorMsg}</p>
                <button
                  onClick={() => {
                    if (mode === "qrcode") fetchQrCode();
                    else setState("phone_input");
                  }}
                  className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
                >
                  重试
                </button>
              </div>
            )}
          </>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <p className="text-lg font-medium text-green-700 mt-3">
              登录成功
            </p>
            <p className="text-sm text-gray-500 mt-1">
              现在可以使用全部功能
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
