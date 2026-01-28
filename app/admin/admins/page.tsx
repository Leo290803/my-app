"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type AdminItem = {
  user_id: string;
  nome: string | null;
  cpf: string | null;
  ativo: boolean | null;
  created_at?: string | null;
};

export default function AdminsPage() {
  const [lista, setLista] = useState<AdminItem[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setMsg("");
    setLoading(true);

    const { data, error } = await supabase
      .from("perfis")
      .select("user_id, nome, cpf, ativo, created_at")
      .eq("tipo", "ADMIN")
      .order("nome", { ascending: true });

    setLoading(false);

    if (error) {
      setMsg("Erro ao carregar admins: " + error.message);
      return;
    }

    setLista((data ?? []) as AdminItem[]);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admins do sistema</h1>
          <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
            Lista de perfis com acesso administrativo ao sistema.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={carregar}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              cursor: "pointer",
              border: "1px solid #ddd",
              background: "#fff",
            }}
          >
            Atualizar
          </button>

          <Link
            href="/admin/admins/novo"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid #93c5fd",
              background: "#dbeafe",
              color: "#1d4ed8",
              fontWeight: 600,
            }}
          >
            + Cadastrar novo Admin
          </Link>
        </div>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 16, border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 160px 120px 220px",
            gap: 10,
            padding: 12,
            fontWeight: 700,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          <span>Nome</span>
          <span>CPF</span>
          <span>Status</span>
          <span>Criado em</span>
        </div>

        {loading ? (
          <div style={{ padding: 12 }}>Carregando...</div>
        ) : (
          <>
            {lista.map((a) => (
              <div
                key={a.user_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 160px 120px 220px",
                  gap: 10,
                  padding: 12,
                  borderBottom: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600 }}>{a.nome ?? "—"}</span>
                <span>{a.cpf ?? "—"}</span>
                <span>{a.ativo === false ? "Inativo" : "Ativo"}</span>
                <span>{a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</span>
              </div>
            ))}

            {lista.length === 0 && <div style={{ padding: 12 }}>Nenhum admin cadastrado.</div>}
          </>
        )}
      </div>
    </main>
  );
}