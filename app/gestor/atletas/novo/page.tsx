"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type Perfil = {
  escola_id: number | null;
  municipio_id: number | null;
  tipo: "ADMIN" | "GESTOR";
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

export default function NovoAtletaPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  // BÁSICO
  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [dataNascimento, setDataNascimento] = useState("");

  // CONTATO
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  // DOCUMENTOS
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [orgaoExpedidor, setOrgaoExpedidor] = useState("");

  // ENDEREÇO
  const [cep, setCep] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");

  // PAIS / RESPONSÁVEIS
  const [nomeMae, setNomeMae] = useState("");
  const [cpfMae, setCpfMae] = useState("");
  const [telefoneMae, setTelefoneMae] = useState("");
  const [nomePai, setNomePai] = useState("");
  const [cpfPai, setCpfPai] = useState("");
  const [telefonePai, setTelefonePai] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("escola_id, municipio_id, tipo")
        .maybeSingle();

      if (error) return setMsg("Erro ao carregar perfil: " + error.message);
      if (!data?.escola_id || !data?.municipio_id) {
        return setMsg("Seu perfil está sem escola/município. Fale com o Admin.");
      }
      setPerfil(data as Perfil);
    })();
  }, []);

  async function salvar() {
    setMsg("");
    if (!perfil) return;

    // validações mínimas
    if (!nome.trim()) return setMsg("Informe o nome completo do atleta.");
    if (!dataNascimento) return setMsg("Informe a data de nascimento.");

    // normalizações
    const cpfLimpo = cpf ? onlyDigits(cpf) : "";
    const rgLimpo = rg ? onlyDigits(rg) : "";
    const telLimpo = telefone ? onlyDigits(telefone) : "";
    const cepLimpo = cep ? onlyDigits(cep) : "";
    const cpfMaeLimpo = cpfMae ? onlyDigits(cpfMae) : "";
    const telMaeLimpo = telefoneMae ? onlyDigits(telefoneMae) : "";
    const cpfPaiLimpo = cpfPai ? onlyDigits(cpfPai) : "";
    const telPaiLimpo = telefonePai ? onlyDigits(telefonePai) : "";

    setSalvando(true);

    const { error } = await supabase.from("atletas").insert({
      escola_id: perfil.escola_id,
      municipio_id: perfil.municipio_id,

      // básico
      nome: nome.trim(),
      sexo,
      data_nascimento: dataNascimento,

      // contato
      email: email.trim() || null,
      telefone: telLimpo || null,

      // documentos
      cpf: cpfLimpo || null,
      rg: rgLimpo || null,
      orgao_expedidor: orgaoExpedidor.trim() || null,

      // endereço
      cep: cepLimpo || null,
      pais: pais.trim() || null,
      estado: estado.trim() || null,
      municipio: municipio.trim() || null,
      logradouro: logradouro.trim() || null,
      numero: numero.trim() || null,
      bairro: bairro.trim() || null,
      complemento: complemento.trim() || null,

      // pais/responsáveis
      nome_mae: nomeMae.trim() || null,
      cpf_mae: cpfMaeLimpo || null,
      telefone_mae: telMaeLimpo || null,
      nome_pai: nomePai.trim() || null,
      cpf_pai: cpfPaiLimpo || null,
      telefone_pai: telPaiLimpo || null,

      // status padrão
      status_doc: "PENDENTE",
      ativo: true,
    });

    setSalvando(false);
    if (error) return setMsg("Erro ao salvar: " + error.message);

    router.push("/gestor/atletas");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Adicionar atleta"
        subtitle="Preencha os dados completos do atleta"
        right={
          <Link
            href="/gestor/atletas"
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
          >
            Voltar
          </Link>
        }
      />

      {msg ? (
        <div className="rounded-xl border bg-white p-3 text-sm text-zinc-700">
          {msg}
        </div>
      ) : null}

      {/* BÁSICO */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Cadastro básico</div>
          <div className="text-sm text-zinc-600">Campos obrigatórios: Nome e Data de nascimento</div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo *">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Nome completo"
            />
          </Field>

          <Field label="Sexo">
            <select
              value={sexo}
              onChange={(e) => setSexo(e.target.value as "M" | "F")}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            >
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </Field>

          <Field label="Data de nascimento *">
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>
        </CardContent>
      </Card>

      {/* CONTATO */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Contato</div>
          <div className="text-sm text-zinc-600">Email e telefone do atleta (se tiver)</div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="email@exemplo.com"
            />
          </Field>

          <Field label="Telefone">
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="(xx) xxxxx-xxxx"
            />
          </Field>
        </CardContent>
      </Card>

      {/* DOCUMENTOS */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Documentos</div>
          <div className="text-sm text-zinc-600">CPF / RG / Órgão expedidor</div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF">
            <input
              value={cpf}
              onChange={(e) => setCpf(onlyDigits(e.target.value))}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Somente números"
              maxLength={11}
            />
          </Field>

          <Field label="RG">
            <input
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="RG"
            />
          </Field>

          <Field label="Órgão expedidor">
            <input
              value={orgaoExpedidor}
              onChange={(e) => setOrgaoExpedidor(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="SSP/RR, etc."
            />
          </Field>
        </CardContent>
      </Card>

      {/* ENDEREÇO */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Endereço</div>
          <div className="text-sm text-zinc-600">Dados de endereço do atleta</div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="CEP">
            <input
              value={cep}
              onChange={(e) => setCep(onlyDigits(e.target.value))}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Somente números"
              maxLength={8}
            />
          </Field>

          <Field label="País">
            <input
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
            />
          </Field>

          <Field label="Estado (UF)">
            <input
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="RR"
              maxLength={2}
            />
          </Field>

          <Field label="Município">
            <input
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Boa Vista"
            />
          </Field>

          <Field label="Logradouro">
            <input
              value={logradouro}
              onChange={(e) => setLogradouro(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Rua/Av..."
            />
          </Field>

          <Field label="Número">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="123"
            />
          </Field>

          <Field label="Bairro">
            <input
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Centro"
            />
          </Field>

          <Field label="Complemento" className="sm:col-span-2 lg:col-span-2">
            <input
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2"
              placeholder="Apto, bloco, referência..."
            />
          </Field>
        </CardContent>
      </Card>

      {/* RESPONSÁVEIS */}
      <Card>
        <CardHeader>
          <div className="font-semibold">Pais / Responsáveis</div>
          <div className="text-sm text-zinc-600">Dados do pai e da mãe (se necessário)</div>
        </CardHeader>

        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border bg-white p-4">
            <div className="font-semibold">Mãe</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome da mãe" plain>
                <input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" />
              </Field>
              <Field label="CPF da mãe" plain>
                <input value={cpfMae} onChange={(e) => setCpfMae(onlyDigits(e.target.value))} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" maxLength={11} />
              </Field>
              <Field label="Telefone da mãe" plain>
                <input value={telefoneMae} onChange={(e) => setTelefoneMae(e.target.value)} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" />
              </Field>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border bg-white p-4">
            <div className="font-semibold">Pai</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome do pai" plain>
                <input value={nomePai} onChange={(e) => setNomePai(e.target.value)} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" />
              </Field>
              <Field label="CPF do pai" plain>
                <input value={cpfPai} onChange={(e) => setCpfPai(onlyDigits(e.target.value))} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" maxLength={11} />
              </Field>
              <Field label="Telefone do pai" plain>
                <input value={telefonePai} onChange={(e) => setTelefonePai(e.target.value)} className="h-11 rounded-xl border bg-white px-3 outline-none focus:ring-2" />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AÇÕES */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/gestor/atletas"
          className="inline-flex h-11 items-center justify-center rounded-xl border bg-white px-4 text-sm font-semibold hover:bg-zinc-50"
        >
          Cancelar
        </Link>

        <button
          onClick={salvar}
          disabled={salvando || !perfil}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar atleta"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
  plain = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  plain?: boolean;
}) {
  // plain=true quando já está dentro de um card interno e não precisa de margin extra
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className={`text-sm font-medium ${plain ? "text-zinc-700" : "text-zinc-700"}`}>
        {label}
      </span>
      {children}
    </label>
  );
}