"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

type Row = {
  id: number;
  equipe_id: number;
  atleta_saida_id: number;
  atleta_entrada_id: number;
  motivo: string | null;
  laudo_url: string | null;
  status: string;
  observacao_admin: string | null;
  created_at: string;

  equipes?: { id: number; nome: string | null };
  atleta_saida?: { id: number; nome: string | null };
  atleta_entrada?: { id: number; nome: string | null };
};

type EquipeOpt = { id: number; nome: string };

function isPendente(status: string) {
  return status === "PENDENTE_APROVACAO" || status === "PENDENTE";
}
function isAprovada(status: string) {
  return status === "APROVADA" || status === "APROVADO";
}
function isRejeitada(status: string) {
  return status === "REJEITADA" || status === "REJEITADO";
}
function fmtStatus(s: string) {
  if (isPendente(s)) return "PENDENTE";
  if (isAprovada(s)) return "APROVADA";
  if (isRejeitada(s)) return "REJEITADA";
  return s;
}
function fmtData(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

export default function AdminSubstituicoesPage() {
  const [msg, setMsg] = useState("");
  const [lista, setLista] = useState<Row[]>([]);
  const [equipes, setEquipes] = useState<EquipeOpt[]>([]);

  // filtros
  const [fStatus, setFStatus] = useState<string>(""); // "", PENDENTE, APROVADA, REJEITADA
  const [fEquipeId, setFEquipeId] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [somentePendentes, setSomentePendentes] = useState<boolean>(true);

  // loading por item (pra não travar a tela)
  const [loadingId, setLoadingId] = useState<number | null>(null);

  async function carregar() {
    setMsg("");

    const { data, error } = await supabase
      .from("substituicoes")
      .select(`
        id,
        equipe_id,
        atleta_saida_id,
        atleta_entrada_id,
        motivo,
        laudo_url,
        status,
        observacao_admin,
        created_at,
        equipes:equipes ( id, nome ),
        atleta_saida:atletas!substituicoes_atleta_saida_id_fkey ( id, nome ),
        atleta_entrada:atletas!substituicoes_atleta_entrada_id_fkey ( id, nome )
      `)
      .order("created_at", { ascending: false });

    if (error) return setMsg("Erro: " + error.message);

    const rows = (data ?? []) as any as Row[];
    setLista(rows);

    // monta lista de equipes (para filtro)
    const map = new Map<number, string>();
    rows.forEach((r) => {
      const nome = r.equipes?.nome ?? `Equipe ${r.equipe_id}`;
      map.set(r.equipe_id, nome);
    });
    const opts = Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setEquipes(opts);
  }

  // update otimista (sumir / mudar status na hora)
  function aplicarUpdateLocal(id: number, novoStatus: string, obsAdmin?: string | null) {
    setLista((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: novoStatus,
              observacao_admin: obsAdmin ?? r.observacao_admin,
            }
          : r
      )
    );
  }

  async function aprovar(id: number) {
    setMsg("");
    setLoadingId(id);

    const r = await fetch("/api/substituicoes/aprovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ substituicao_id: id }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setLoadingId(null);
      return setMsg("Erro ao aprovar: " + (j.error ?? "erro"));
    }

    // ✅ muda na tela na hora
    aplicarUpdateLocal(id, "APROVADA", "Aprovada e aplicada pelo sistema");

    setMsg("Aprovada ✅ (troca aplicada)");
    setLoadingId(null);

    // recarrega por garantia
    setTimeout(() => carregar(), 250);
  }

  async function rejeitar(id: number) {
    setMsg("");
    const obs = (prompt("Motivo para rejeitar?") || "").trim();
    if (!obs) return setMsg("Informe o motivo da rejeição.");

    setLoadingId(id);

    const r = await fetch("/api/substituicoes/rejeitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ substituicao_id: id, observacao_admin: obs }),
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setLoadingId(null);
      return setMsg("Erro ao rejeitar: " + (j.error ?? "erro"));
    }

    // ✅ muda na tela na hora
    aplicarUpdateLocal(id, "REJEITADA", obs);

    setMsg("Rejeitada ✅");
    setLoadingId(null);

    // recarrega por garantia
    setTimeout(() => carregar(), 250);
  }

  const filtradas = useMemo(() => {
    let arr = [...lista];

    // filtro "somente pendentes" (padrão ligado)
    if (somentePendentes) {
      arr = arr.filter((s) => isPendente(s.status));
    }

    // filtro status
    if (fStatus) {
      arr = arr.filter((s) => fmtStatus(s.status) === fStatus);
    }

    // filtro equipe
    const eid = Number(fEquipeId);
    if (eid) {
      arr = arr.filter((s) => s.equipe_id === eid);
    }

    // busca
    const b = busca.trim().toLowerCase();
    if (b) {
      arr = arr.filter((s) => {
        const equipe = (s.equipes?.nome ?? `Equipe ${s.equipe_id}`).toLowerCase();
        const sai = (s.atleta_saida?.nome ?? `#${s.atleta_saida_id}`).toLowerCase();
        const entra = (s.atleta_entrada?.nome ?? `#${s.atleta_entrada_id}`).toLowerCase();
        const motivo = (s.motivo ?? "").toLowerCase();
        const obs = (s.observacao_admin ?? "").toLowerCase();
        const idTxt = String(s.id);
        return (
          equipe.includes(b) ||
          sai.includes(b) ||
          entra.includes(b) ||
          motivo.includes(b) ||
          obs.includes(b) ||
          idTxt.includes(b)
        );
      });
    }

    return arr;
  }, [lista, somentePendentes, fStatus, fEquipeId, busca]);

  const kpi = useMemo(() => {
    const total = lista.length;
    const pend = lista.filter((x) => isPendente(x.status)).length;
    const aprov = lista.filter((x) => isAprovada(x.status)).length;
    const rej = lista.filter((x) => isRejeitada(x.status)).length;
    return { total, pend, aprov, rej };
  }, [lista]);

  useEffect(() => {
    carregar();
  }, []);

  const card: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  };
  const tiny: React.CSSProperties = { fontSize: 12, opacity: 0.8 };

  return (
    <main style={{ padding: 24, maxWidth: 1150 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Admin • Substituições</h1>

      {msg && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          {msg}
        </div>
      )}

      {/* KPIs */}
      <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div style={card}>
          <div style={tiny}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{kpi.total}</div>
        </div>
        <div style={card}>
          <div style={tiny}>Pendentes</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{kpi.pend}</div>
        </div>
        <div style={card}>
          <div style={tiny}>Aprovadas</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{kpi.aprov}</div>
        </div>
        <div style={card}>
          <div style={tiny}>Rejeitadas</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{kpi.rej}</div>
        </div>
      </div>

      {/* Filtros */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 1.5fr 1fr 140px",
          alignItems: "end",
        }}
      >
        <div>
          <div style={tiny}>Status</div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todos</option>
            <option value="PENDENTE">Pendente</option>
            <option value="APROVADA">Aprovada</option>
            <option value="REJEITADA">Rejeitada</option>
          </select>
        </div>

        <div>
          <div style={tiny}>Equipe</div>
          <select value={fEquipeId} onChange={(e) => setFEquipeId(e.target.value)} style={{ padding: 10, width: "100%" }}>
            <option value="">Todas</option>
            {equipes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={tiny}>Buscar (equipe/atleta/id/motivo)</div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="ex: handebol, atleta 8, #7, motivo..."
            style={{ padding: 10, width: "100%" }}
          />
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
          <input type="checkbox" checked={somentePendentes} onChange={(e) => setSomentePendentes(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Somente pendentes</span>
        </label>

        <button onClick={carregar} style={{ padding: 10, borderRadius: 8, cursor: "pointer" }}>
          Recarregar
        </button>
      </div>

      {/* Lista */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 10, overflow: "hidden" }}>
        {filtradas.map((s) => {
          const equipeNome = s.equipes?.nome ?? `Equipe ${s.equipe_id}`;
          const saidaNome = s.atleta_saida?.nome ?? `#${s.atleta_saida_id}`;
          const entradaNome = s.atleta_entrada?.nome ?? `#${s.atleta_entrada_id}`;

          return (
            <div key={s.id} style={{ padding: 12, borderBottom: "1px solid #eee", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>
                  #{s.id} • {equipeNome} • {fmtStatus(s.status)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{fmtData(s.created_at)}</div>
              </div>

              <div style={{ fontSize: 13, opacity: 0.95 }}>
                Sai: <b>{saidaNome}</b> → Entra: <b>{entradaNome}</b>
              </div>

              {s.motivo ? <div style={{ fontSize: 13, opacity: 0.9 }}>Motivo: {s.motivo}</div> : null}

              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {s.laudo_url ? (
                  <a href={s.laudo_url} target="_blank" rel="noreferrer">
                    Abrir laudo
                  </a>
                ) : (
                  <span style={{ fontSize: 12, opacity: 0.75 }}>Sem laudo</span>
                )}

                {s.observacao_admin ? (
                  <span style={{ fontSize: 12, opacity: 0.85 }}>Obs admin: {s.observacao_admin}</span>
                ) : null}
              </div>

              {isPendente(s.status) && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    disabled={loadingId === s.id}
                    onClick={() => aprovar(s.id)}
                    style={{ padding: 10, borderRadius: 8, cursor: "pointer", opacity: loadingId === s.id ? 0.6 : 1 }}
                  >
                    {loadingId === s.id ? "Aprovando..." : "Aprovar"}
                  </button>
                  <button
                    disabled={loadingId === s.id}
                    onClick={() => rejeitar(s.id)}
                    style={{ padding: 10, borderRadius: 8, cursor: "pointer", opacity: loadingId === s.id ? 0.6 : 1 }}
                  >
                    {loadingId === s.id ? "Rejeitando..." : "Rejeitar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtradas.length === 0 && <div style={{ padding: 12 }}>Nenhuma solicitação no filtro atual.</div>}
      </div>
    </main>
  );
}
