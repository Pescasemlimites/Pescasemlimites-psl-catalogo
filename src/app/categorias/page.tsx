"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "../../components/Header";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";

type Categoria = {
  id: number;
  nome: string;
};

// Mapeamento de nomes de categorias para ícones
const ICON_MAP: Record<string, string> = {
  Pistolas: "/icons/pistola.png",
  "Revólveres": "/icons/revolver.png",
  Espingarda_Semi: "/icons/espingardaSemi.png",
  Espingarda_Rep: "/icons/espingardaRep.png",
  Carabinas: "/icons/carabina.png",
  Fuzil: "/icons/fuzil.png",
};

/** Troca hífens e underscores por espaços e capitaliza o início de cada palavra (pt-BR). */
function formatCategoriaLabel(nome: string): string {
  const spaced = nome
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return nome;
  return spaced
    .split(" ")
    .map((word) => {
      if (!word) return word;
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export default function CategoriasPage() {
  const router = useRouter();
  const { authLoading, userId } = useAuth();
  const [listLoading, setListLoading] = useState(true);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    if (authLoading || !userId) return;

    let cancelled = false;

    void (async () => {
      setListLoading(true);
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome")
        .order("nome");

      if (cancelled) return;

      if (error) {
        console.error("Erro ao buscar categorias:", error);
      } else if (data) {
        setCategorias(data);
      }
      setListLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  const handleCategoriaClick = (categoriaId: number) => {
    router.push(`/produtos?categoria=${categoriaId}`);
  };

  if (authLoading || !userId) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#030711" }}
      >
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (listLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#030711" }}
      >
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#030711" }}
    >
      <Header />

      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Título da seção */}
          <div className="mb-8 flex items-center gap-3">
            <svg
              className="h-8 w-8 shrink-0 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
            <h1 className="text-3xl font-light tracking-wide text-white md:text-4xl">
              Categorias
            </h1>
          </div>

          {/* Grid de categorias */}
          {categorias.length === 0 ? (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-8 text-center">
              <p className="text-zinc-400">Nenhuma categoria encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {categorias.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => handleCategoriaClick(categoria.id)}
                  className="flex items-center gap-4 rounded-xl px-5 py-4 text-left transition-opacity hover:opacity-95"
                  style={{ backgroundColor: "#E9B20E" }}
                >
                  {ICON_MAP[categoria.nome] && (
                    <Image
                      src={ICON_MAP[categoria.nome]}
                      alt={formatCategoriaLabel(categoria.nome)}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 object-contain"
                    />
                  )}
                  <span className="text-base font-medium tracking-normal text-zinc-900">
                    {formatCategoriaLabel(categoria.nome)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
