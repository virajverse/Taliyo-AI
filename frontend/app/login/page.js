"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login as apiLogin, verifyAuth as apiVerifyAuth } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // If already logged in, verify and redirect to home
    const check = async () => {
      try {
        await apiVerifyAuth();
        router.replace("/");
      } catch (e) {
        // ignore; probably not logged in or auth disabled
      }
    };
    check();
  }, [router]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await apiLogin(passcode);
      try { localStorage.setItem("taliyo_token", token); } catch {}
      router.replace("/");
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Login failed";
      setError(String(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] md:min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur">
        <h1 className="text-2xl font-semibold mb-2 text-center">Taliyo AI</h1>
        <p className="text-sm text-zinc-400 mb-6 text-center">Enter passcode to continue</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Passcode</label>
            <div className="flex items-center gap-2 border border-zinc-800 rounded-lg bg-zinc-950 px-2">
              <input
                type={show ? "text" : "password"}
                className="flex-1 px-2 py-2 bg-transparent outline-none text-zinc-100"
                placeholder="••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
              />
              <button type="button" className="text-zinc-400 hover:text-zinc-200 text-sm px-2" onClick={() => setShow(v => !v)}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold disabled:opacity-60"
            disabled={loading || !passcode}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500 text-center">
          If passcode is disabled, you will be redirected automatically.
        </p>
      </div>
    </main>
  );
}
