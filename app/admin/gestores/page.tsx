"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type EscolaItem = { id: number; nome: string };

export default function GestoresPage() {
  const [escolas, setEscolas] = useState<EscolaItem[]>([]);
  const [escolaId, setEscolaId] = useState<string>("");

  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("");

  async function carregarEscolas() {
    const { data, error } = await supabase
      .from("escolas")
      .select("id, nome")
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar escolas: " + error.message);
      return;
    }
    setEscolas((data ?? []) as any);
  }

  async function criarGestor() {
    setMsg("");

    const cpfLimpo = cpf.replace(/\D/g, "");
    const eid = Number(escolaId);

    if (!cpfLimpo || cpfLimpo.length < 11) {
      setMsg("CPF inválido.");
      return;
    }
    if (!nome.trim()) {
      setMsg("Informe o nome do gestor.");
      return;
    }
    if (!eid) {
      setMsg("Selecione a escola.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMsg("Você não está autenticado.");
      return;
    }

    setMsg("Criando gestor...");

    const res = await fetch("/api/admin/criar-gestor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cpf: cpfLimpo,
        nome: nome.trim(),
        escola_id: eid,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setMsg("Erro: " + (json.error ?? "falha ao criar gestor"));
      return;
    }

    setCpf("");
    setNome("");
    setEscolaId("");

    setMsg(`Gestor criado ✅  Login: ${json.email}  Senha inicial: ${json.senhaInicial}`);
  }

  useEffect(() => {
    carregarEscolas();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin • Gestores</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <select
          value={escolaId}
          onChange={(e) => setEscolaId(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="">Selecione a escola...</option>
          {escolas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>

        <input
          placeholder="CPF do gestor (somente números)"
          value={cpf}
          onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <input
          placeholder="Nome do gestor"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <button onClick={criarGestor} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Criar Gestor
        </button>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </main>
  );
}
