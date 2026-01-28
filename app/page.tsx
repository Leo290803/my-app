"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

export default function LoginPage() {
  const router = useRouter();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  function cpfParaEmail(valor: string) {
    return `${valor}@jers.local`;
  }

  async function login() {
    setMsg("");

    const cpfLimpo = onlyDigits(cpf);
    if (!cpfLimpo || !senha) {
      setMsg("Informe CPF e senha.");
      return;
    }

    setLoading(true);
    setMsg("Entrando...");

    const email = cpfParaEmail(cpfLimpo);

    // 1) LOGIN NO AUTH
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (loginError) {
      setLoading(false);
      setMsg("Erro no login: " + loginError.message);
      return;
    }

    // 2) PEGAR SESSÃO E USER_ID
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      setLoading(false);
      setMsg("Erro ao obter sessão do usuário.");
      return;
    }

    const userId = sessionData.session.user.id;

    // 3) BUSCAR PERFIL PELO USER_ID
    const { data: perfil, error: perfilError } = await supabase
      .from("perfis")
      .select("tipo, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfilError) {
      setLoading(false);
      setMsg("Erro ao buscar perfil: " + perfilError.message);
      return;
    }

    if (!perfil) {
      setLoading(false);
      setMsg("Usuário sem perfil cadastrado. Fale com o administrador.");
      await supabase.auth.signOut();
      return;
    }

    if (!perfil.ativo) {
      setLoading(false);
      setMsg("Usuário inativo. Procure o administrador.");
      await supabase.auth.signOut();
      return;
    }

    // 4) REDIRECIONAR PELO TIPO
    setLoading(false);
    if (perfil.tipo === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/gestor");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 10% 10%, rgba(14,165,233,.35), transparent 50%)," +
          "radial-gradient(900px 500px at 90% 20%, rgba(59,130,246,.35), transparent 50%)," +
          "linear-gradient(135deg, #0b3b91, #0ea5e9)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 18,
        }}
      >
        {/* LADO ESQUERDO (APRESENTAÇÃO) */}
        <section
          style={{
            color: "#fff",
            borderRadius: 18,
            padding: 28,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.22)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 18px 45px rgba(0,0,0,0.25)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 420,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* LOGO */}
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 10,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.25)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
              }}
            >
              <img
                src="/idjuv.png"
                alt="IDJUV"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={(e) => {
                  // se não achar a imagem, só esconde pra não quebrar layout
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              {/* fallback textual caso não tenha logo */}
          
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.9, letterSpacing: 1 }}>
                IDJUV • RORAIMA
              </div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
                JERS – Sistema de Inscrições
              </h1>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                Acesso para <b>Gestor</b>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gap: 10 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div style={{ fontWeight: 800 }}>Dica</div>
              <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4, lineHeight: 1.35 }}>
                Seu usuário é o <b>CPF</b> <b></b><br />
                Se esquecer a senha, peça ao Admin para redefinir.
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.9 }}>
              © {new Date().getFullYear()} • IDJUV / JERS
            </div>
          </div>
        </section>

        {/* LADO DIREITO (FORM) */}
        <section
          style={{
            background: "rgba(255,255,255,0.10)",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 18px 45px rgba(0,0,0,0.25)",
            border: "1px solid rgba(0,0,0,0.06)",
            minHeight: 420,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Entrar</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.7 }}>
              Informe CPF e senha para acessar o sistema.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>CPF</label>
              <input
                type="text"
                placeholder="Somente números"
                value={cpf}
                onChange={(e) => setCpf(onlyDigits(e.target.value))}
                inputMode="numeric"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>Senha</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  style={{
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "rgba(255,255,255,0.10)",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            <button
              onClick={login}
              disabled={loading}
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 12,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 900,
                background: "linear-gradient(135deg, #0b3b91, #2563eb)",
                color: "#fff",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {msg && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  padding: 10,
                  borderRadius: 12,
                  background: msg.startsWith("Erro") ? "#fee2e2" : "#eef2ff",
                  border: "1px solid " + (msg.startsWith("Erro") ? "#fecaca" : "#c7d2fe"),
                  color: msg.startsWith("Erro") ? "#991b1b" : "#1e3a8a",
                }}
              >
                {msg}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Responsivo (mobile) */}
      <style jsx>{`
        @media (max-width: 900px) {
          main > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}