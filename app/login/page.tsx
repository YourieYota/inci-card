"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Show expired session message if redirected by proxy
    if (searchParams.get('expired') === '1') {
      setError("Votre session a expiré. Veuillez vous reconnecter.");
    }

    // Only clear cookies if arriving from an explicit logout action
    const isLogout = searchParams.get('logout') === '1' || searchParams.get('callbackUrl');
    if (isLogout) {
      const cookiesToClear = [
        'next-auth.session-token',
        '__Secure-next-auth.session-token',
        'next-auth.csrf-token',
        '__Host-next-auth.csrf-token',
      ];
      cookiesToClear.forEach((name) => {
        document.cookie = `${name}=; Max-Age=0; path=/;`;
        document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname};`;
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError("Identifiants invalides");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-[#0b0f19] dark:via-[#0d1225] dark:to-[#0b0f19] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-900/90 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/30 overflow-hidden border border-slate-100 dark:border-slate-800/80">
        <div className="p-8">
          <div className="flex flex-col items-center justify-center mb-8">
            <img src="/logo-imprimerie.png" className="h-16 object-contain mb-4" alt="Logo Imprimerie Nationale" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Imprimerie Nationale</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Connectez-vous à votre espace</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Adresse email ou Identifiant
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131b2e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="Ex: admin@imprimerie.ci ou admin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131b2e] text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-blue-500/30 dark:shadow-blue-600/20 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
            </button>
          </form>
        </div>
        
        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Plateforme Multi-tenant © 2026 Imprimerie Nationale
          </p>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense boundary as required by Next.js for useSearchParams()
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
