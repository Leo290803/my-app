"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

function getAnoFromISODate(iso: string) {
  const ano = (iso ?? "").slice(0, 4);
  return /^\d{4}$/.test(ano) ? ano : null;
}

export default function NovoAdminPage() {
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState(""); // YYYY-MM-DD

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function criarAdmin() {
    setMsg("");

    const cpfLimpo = onlyDigits(cpf);
    if (!nome.trim()) return setMsg("Informe o nome.");
    if (!cpfLimpo || cpfLimpo.length !== 11) return setMsg("CPF inválido (11 dígitos).");
    if (!dataNasc) return setMsg("Informe a data de nascimento.");

    const ano = getAnoFromISODate(dataNasc);
    if (!ano) return setMsg("Data de nascimento inválida.");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setMsg("Você não está autenticado.");

    setSalvando(true);
    setMsg("Criando admin...");

    const res = await fetch("/api/admin/criar-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cpf: cpfLimpo,
        nome: nome.trim(),
        data_nascimento: dataNasc,
      }),
    });

    const json = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setMsg("Erro: " + (json.error ?? "falha ao criar admin"));
      return;
    }

    setMsg(`Admin criado ✅  Usuário: ${json.loginCpf}  Senha: ${json.senhaInicial}`);

    setCpf("");
    setNome("");
    setDataNasc("");
  }

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Cadastrar novo Admin</h1>
        <Link
          href="/admin"
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none" }}
        >
          Voltar
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <input
          placeholder="Nome do admin *"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input
            placeholder="CPF (somente números) *"
            value={cpf}
            onChange={(e) => setCpf(onlyDigits(e.target.value))}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <input
            type="date"
            value={dataNasc}
            onChange={(e) => setDataNasc(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <button onClick={criarAdmin} disabled={salvando} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          {salvando ? "Salvando..." : "Criar admin"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Regra da senha: <b>anoNascimento + últimos 4 dígitos do CPF</b>. Ex.: 2001 + 1234 = <b>20011234</b>
        </div>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </main>
  );
}