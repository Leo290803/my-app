"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

type EscolaItem = { id: number; nome: string };

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

export default function NovoGestorPage() {
  const router = useRouter();

  const [escolas, setEscolas] = useState<EscolaItem[]>([]);
  const [escolaId, setEscolaId] = useState<string>("");

  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [dataNasc, setDataNasc] = useState(""); // yyyy-mm-dd

  const [rg, setRg] = useState("");
  const [telefone, setTelefone] = useState("");
  const [emailContato, setEmailContato] = useState("");

  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregarEscolas() {
    const { data, error } = await supabase.from("escolas").select("id, nome").order("nome");
    if (error) return setMsg("Erro ao carregar escolas: " + error.message);
    setEscolas((data ?? []) as any);
  }

  useEffect(() => {
    carregarEscolas();
  }, []);

  async function criarGestor() {
    setMsg("");

    const cpfLimpo = onlyDigits(cpf);
    const eid = Number(escolaId);

    if (!eid) return setMsg("Selecione a escola.");
    if (!nome.trim()) return setMsg("Informe o nome.");
    if (!cpfLimpo || cpfLimpo.length !== 11) return setMsg("CPF inválido (11 dígitos).");
    if (!dataNasc) return setMsg("Informe a data de nascimento.");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setMsg("Você não está autenticado.");

    setSalvando(true);
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
        data_nascimento: dataNasc,
        rg: rg.trim() || null,
        telefone: telefone.trim() || null,
        email_contato: emailContato.trim() || null,
      }),
    });

    const json = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setMsg("Erro: " + (json.error ?? "falha ao criar gestor"));
      return;
    }

    // json.loginCpf / json.senhaInicial
    setMsg(`Gestor criado ✅  Usuário: ${json.loginCpf}  Senha: ${json.senhaInicial}`);

    // limpa
    setCpf("");
    setNome("");
    setDataNasc("");
    setRg("");
    setTelefone("");
    setEmailContato("");
    setEscolaId("");

    // opcional: volta pra lista
    // router.push("/admin/gestores");
    // router.refresh();
  }

  return (
    <main style={{ padding: 24, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Cadastrar novo gestor</h1>
        <Link
          href="/admin/gestores"
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", textDecoration: "none" }}
        >
          Voltar
        </Link>
      </div>

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
          placeholder="Nome do gestor *"
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input
            placeholder="RG (opcional)"
            value={rg}
            onChange={(e) => setRg(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <input
            placeholder="Telefone (opcional)"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <input
          placeholder="Email de contato (opcional)"
          value={emailContato}
          onChange={(e) => setEmailContato(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <button onClick={criarGestor} disabled={salvando} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          {salvando ? "Salvando..." : "Criar gestor"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Regra da senha: <b>anoNascimento + últimos 4 dígitos do CPF</b>. Ex.: 2001 + 1234 = <b>20011234</b>
        </div>

        {msg && <p style={{ marginTop: 8 }}>{msg}</p>}
      </div>
    </main>
  );
}