import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  card: {
    width: 260,
    height: 360,
    border: "1px solid #111",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  header: { fontSize: 14, fontWeight: 700 },
  row: { fontSize: 10 },
  foto: { width: 120, height: 120, borderRadius: 8 },
  modalidades: { fontSize: 10, marginTop: 6 },
  footer: { marginTop: "auto", fontSize: 9, opacity: 0.8 },
});

type Props = {
  nome: string;
  escola: string;
  municipio: string;
  categoria: string;
  naipe: string;
  fotoUrl?: string | null;
  modalidadesTexto: string;
};

export function CrachaPDF(props: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>JERS • Crachá</Text>

      {props.fotoUrl ? (
        <Image src={props.fotoUrl} style={styles.foto} />
      ) : (
        <Text style={styles.row}>Sem foto</Text>
      )}

      <Text style={styles.row}>Nome: {props.nome}</Text>
      <Text style={styles.row}>Escola: {props.escola}</Text>
      <Text style={styles.row}>Município: {props.municipio}</Text>
      <Text style={styles.row}>Categoria: {props.categoria}</Text>
      <Text style={styles.row}>Naipe: {props.naipe}</Text>

      <Text style={styles.modalidades}>
        Modalidades: {props.modalidadesTexto || "—"}
      </Text>

      <Text style={styles.footer}>Documento oficial JERS</Text>
    </View>
  );
}
