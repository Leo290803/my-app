"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminPage() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setInfo(data.user);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Área do Admin</h1>
      <pre>{JSON.stringify(info, null, 2)}</pre>
    </main>
  );
}
