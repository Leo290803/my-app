"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = {
  escola_id: number | null;
  municipio_id: number | null;
  tipo: "ADMIN" | "GESTOR";
};

type Equipe = {
  id: number;
  nome: string;
  cpf: string | null;
  funcao: string;
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;
};

const FUNCOES = [
  "CHEFE_DE_DELEGACAO",
  "TECNICO",
  "AUXILIAR",
  "OFICIAL",
] as const;

export default function GestorEquipePage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<Equipe[]>([]);
  const [msg, setMsg] = useState("");

  // Form
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [funcao, setFuncao] = useState<(typeof FUNCOES)[number]>("TECNICO");

  async function carregarPerfil() {
    const { data, error } = await supabase
      .from("perfis")
      .select("escola_id, municipio_id, tipo")
      .maybeSingle();

    if (error) {
      setMsg("Erro ao carregar perfil: " + error.message);
      return;
    }

    if (!data?.escola_id || !data?.municipio_id) {
      setMsg("Perfil do gestor está sem escola/município. Fale com o Admin.");
      return;
    }

    setPerfil(data as Perfil);
  }

  async function carregarEquipe(escolaId: number) {
    const { data, error } = await supabase
      .from("equipe_tecnica")
      .select("id, nome, cpf, funcao, status_doc, ativo")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar equipe: " + error.message);
      return;
    }

    setLista((data ?? []) as unknown as Equipe[]);
  }

  async function adicionar() {
    setMsg("");
    if (!perfil) return;

    if (!nome.trim()) {
      setMsg("Informe o nome.");
      return;
    }

    const cpfLimpo = cpf ? cpf.replace(/\D/g, "") : "";

    const { error } = await supabase.from("equipe_tecnica").insert({
      escola_id: perfil.escola_id,
      municipio_id: perfil.municipio_id,
      nome: nome.trim(),
      cpf: cpfLimpo || null,
      funcao,
      status_doc: "PENDENTE",
      ativo: true,
    });

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setCpf("");
    setFuncao("TECNICO");
    setMsg("Cadastro realizado ✅");

    carregarEquipe(perfil.escola_id!);
  }

  useEffect(() => {
    (async () => {
      await carregarPerfil();
    })();
  }, []);

  useEffect(() => {
    if (perfil?.escola_id) carregarEquipe(perfil.escola_id);
  }, [perfil?.escola_id]);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>
        Gestor • Equipe Técnica / Oficiais
      </h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <input
          placeholder="CPF (opcional)"
          value={cpf}
          onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <select
          value={funcao}
          onChange={(e) => setFuncao(e.target.value as any)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          {FUNCOES.map((f) => (
            <option key={f} value={f}>
              {f.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <button
          onClick={adicionar}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
        >
          Cadastrar
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>
        Lista da equipe
      </h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {lista.map((p) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 140px 120px",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid #eee",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{p.nome}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                CPF: {p.cpf ?? "—"}
              </div>
            </div>

            <span>{p.funcao.replaceAll("_", " ")}</span>
            <span>{p.status_doc}</span>
            <span>{p.ativo ? "Ativo" : "Inativo"}</span>
          </div>
        ))}

        {lista.length === 0 && (
          <div style={{ padding: 12 }}>Nenhum cadastro ainda.</div>
        )}
      </div>
    </main>
  );
}
