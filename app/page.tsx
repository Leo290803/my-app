"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");

  function cpfParaEmail(valor: string) {
    return `${valor}@jers.local`;
  }

  async function login() {
    setMsg("Entrando...");

    if (!cpf || !senha) {
      setMsg("Informe CPF e senha.");
      return;
    }

    const email = cpfParaEmail(cpf);

    // 1️⃣ LOGIN NO AUTH
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (loginError) {
      setMsg("Erro no login: " + loginError.message);
      return;
    }

    // 2️⃣ PEGAR SESSÃO E USER_ID
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      setMsg("Erro ao obter sessão do usuário.");
      return;
    }

    const userId = sessionData.session.user.id;

    // 3️⃣ BUSCAR PERFIL PELO USER_ID (EVITA ERRO E LOOP)
    const { data: perfil, error: perfilError } = await supabase
      .from("perfis")
      .select("tipo, ativo")
      .eq("user_id", userId)
      .maybeSingle();

    if (perfilError) {
      setMsg("Erro ao buscar perfil: " + perfilError.message);
      return;
    }

    if (!perfil) {
      setMsg("Usuário sem perfil cadastrado. Fale com o administrador.");
      await supabase.auth.signOut();
      return;
    }

    if (!perfil.ativo) {
      setMsg("Usuário inativo. Procure o administrador.");
      await supabase.auth.signOut();
      return;
    }

    // 4️⃣ REDIRECIONAR PELO TIPO
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
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: 360,
          padding: 24,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
          JERS – Sistema de Inscrições
        </h1>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            type="text"
            placeholder="CPF (somente números)"
            value={cpf}
            onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
            style={{
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />

          <button
            onClick={login}
            style={{
              padding: 10,
              borderRadius: 6,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Entrar
          </button>

          {msg && (
            <p style={{ marginTop: 8, fontSize: 14, color: "#333" }}>{msg}</p>
          )}
        </div>
      </div>
    </main>
  );
}
