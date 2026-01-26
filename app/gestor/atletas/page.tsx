"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Perfil = {
  escola_id: number | null;
  municipio_id: number | null;
  tipo: "ADMIN" | "GESTOR";
};

type Atleta = {
  id: number;
  nome: string;
  cpf: string | null;
  data_nascimento: string; // yyyy-mm-dd
  sexo: "M" | "F";
  status_doc: "PENDENTE" | "CONCLUIDO";
  ativo: boolean;
};

function calcCategoria(dataNascimento: string) {
  // Regra simples por idade (você pode ajustar depois por "ano-base" do evento)
  const hoje = new Date();
  const dn = new Date(dataNascimento);
  let idade = hoje.getFullYear() - dn.getFullYear();
  const m = hoje.getMonth() - dn.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) idade--;

  if (idade >= 12 && idade <= 14) return "12–14";
  if (idade >= 15 && idade <= 17) return "15–17";
  return "Fora da faixa";
}

export default function GestorAtletasPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<Atleta[]>([]);
  const [msg, setMsg] = useState("");

  // Form
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");

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

  async function carregarAtletas(escolaId: number) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome, cpf, data_nascimento, sexo, status_doc, ativo")
      .eq("escola_id", escolaId)
      .order("nome");

    if (error) {
      setMsg("Erro ao carregar atletas: " + error.message);
      return;
    }
    setLista((data ?? []) as unknown as Atleta[]);
  }

  async function adicionar() {
    setMsg("");
    if (!perfil) return;

    if (!nome.trim()) {
      setMsg("Informe o nome do atleta.");
      return;
    }
    if (!dataNascimento) {
      setMsg("Informe a data de nascimento.");
      return;
    }

    const cpfLimpo = cpf ? cpf.replace(/\D/g, "") : "";

    const { error } = await supabase.from("atletas").insert({
      escola_id: perfil.escola_id,
      municipio_id: perfil.municipio_id,
      nome: nome.trim(),
      cpf: cpfLimpo || null,
      data_nascimento: dataNascimento,
      sexo,
      status_doc: "PENDENTE",
      ativo: true,
    });

    if (error) {
      setMsg("Erro ao salvar: " + error.message);
      return;
    }

    setNome("");
    setCpf("");
    setDataNascimento("");
    setSexo("M");
    setMsg("Atleta cadastrado ✅");
    carregarAtletas(perfil.escola_id!);
  }

  useEffect(() => {
    (async () => {
      await carregarPerfil();
    })();
  }, []);

  useEffect(() => {
    if (perfil?.escola_id) carregarAtletas(perfil.escola_id);
  }, [perfil?.escola_id]);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Gestor • Atletas</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 520 }}>
        <input
          placeholder="Nome do atleta"
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

        <input
          type="date"
          value={dataNascimento}
          onChange={(e) => setDataNascimento(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <select
          value={sexo}
          onChange={(e) => setSexo(e.target.value as "M" | "F")}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        >
          <option value="M">Masculino</option>
          <option value="F">Feminino</option>
        </select>

        <button
          onClick={adicionar}
          style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}
        >
          Cadastrar atleta
        </button>

        {msg && <p>{msg}</p>}
      </div>

      <h2 style={{ marginTop: 28, fontSize: 18, fontWeight: 700 }}>
        Lista de atletas
      </h2>

      <div style={{ marginTop: 8, border: "1px solid #eee", borderRadius: 8 }}>
        {lista.map((a) => (
          <div
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 120px 120px",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid #eee",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{a.nome}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                CPF: {a.cpf ?? "—"} • Nasc.: {a.data_nascimento} • Categoria:{" "}
                {calcCategoria(a.data_nascimento)}
              </div>
            </div>

            <span>{a.sexo === "M" ? "Masculino" : "Feminino"}</span>
            <span>{a.status_doc}</span>
            <span>{a.ativo ? "Ativo" : "Inativo"}</span>
          </div>
        ))}
        {lista.length === 0 && (
          <div style={{ padding: 12 }}>Nenhum atleta cadastrado ainda.</div>
        )}
      </div>
    </main>
  );
}
