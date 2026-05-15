"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";

export default function Header() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAdmin } = useAuth();

  const handleCategorias = () => {
    router.push("/categorias");
    setIsMenuOpen(false);
  };
  
  const handleCadastros = () => {
    router.push("/cadastros");
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="w-full border-b border-zinc-800" style={{ backgroundColor: "#030711" }}>
      <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-6">
        {/* Logo */}
        <div 
          className="flex items-center cursor-pointer"
          onClick={() => router.push("/dashboard")}
        >
          <Image
            src="/logo.png"
            alt="PESCA SEM LIMITES"
            width={200}
            height={50}
            className="h-auto"
            priority
          />
        </div>

        {/* Navegação principal (texto amarelo) */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-8 px-4" aria-label="Principal">
          <button
            type="button"
            onClick={() => router.push("/produtos")}
            className="text-sm font-semibold tracking-wide transition-opacity hover:opacity-90"
            style={{ color: "#E9B20E" }}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => router.push("/promocoes")}
            className="text-sm font-semibold tracking-wide transition-opacity hover:opacity-90"
            style={{ color: "#E9B20E" }}
          >
            Promoções
          </button>
        </nav>

        {/* Desktop buttons - hidden on mobile */}
        <div className="hidden md:flex shrink-0 items-center gap-3">
          {/* Categorias Button */}
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
            style={{ backgroundColor: "#E9B20E" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4A00D")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E9B20E")}
            onClick={() => router.push("/categorias")}
          >
            <svg
              className="h-4 w-4 text-zinc-900"
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
            <span className="text-sm font-light tracking-wide text-zinc-900">
              Categorias
            </span>
          </button>

          {/* Cadastros Button - apenas para admin */}
          {isAdmin && (
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors"
              style={{ backgroundColor: "#E9B20E" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4A00D")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E9B20E")}
              onClick={() => router.push("/cadastros")}
            >
              <svg
                className="h-4 w-4 text-zinc-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm font-bold text-zinc-900">Cadastros</span>
            </button>
          )}

          {/* Logout Button */}
          <button
            className="flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors"
            style={{ borderColor: "#E9B20E", backgroundColor: "transparent" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(233, 178, 14, 0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            onClick={handleLogout}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
              style={{ color: "#E9B20E" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="text-sm font-bold" style={{ color: "#E9B20E" }}>
              Sair
            </span>
          </button>
        </div>

        {/* Mobile menu button - visible only on mobile */}
        <button
          className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
          style={{ color: "#E9B20E" }}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-zinc-800" style={{ backgroundColor: "#030711" }}>
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 border-b border-zinc-800 pb-3">
              <button
                type="button"
                className="w-full py-2 text-left text-sm font-semibold"
                style={{ color: "#E9B20E" }}
                onClick={() => {
                  router.push("/produtos");
                  setIsMenuOpen(false);
                }}
              >
                Produtos
              </button>
              <button
                type="button"
                className="w-full py-2 text-left text-sm font-semibold"
                style={{ color: "#E9B20E" }}
                onClick={() => {
                  router.push("/promocoes");
                  setIsMenuOpen(false);
                }}
              >
                Promoções
              </button>
            </div>
            {/* Categorias Button */}
            <button
              className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors w-full"
              style={{ backgroundColor: "#E9B20E" }}
              onClick={handleCategorias}
            >
              <svg
                className="h-4 w-4 text-zinc-900"
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
              <span className="text-sm font-light tracking-wide text-zinc-900">
                Categorias
              </span>
            </button>

            {/* Cadastros Button - apenas para admin */}
            {isAdmin && (
              <button
                className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors w-full"
                style={{ backgroundColor: "#E9B20E" }}
                onClick={handleCadastros}
              >
                <svg
                  className="h-4 w-4 text-zinc-900"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-sm font-bold text-zinc-900">Cadastros</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              className="flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors w-full"
              style={{ borderColor: "#E9B20E", backgroundColor: "transparent" }}
              onClick={handleLogout}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                style={{ color: "#E9B20E" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="text-sm font-bold" style={{ color: "#E9B20E" }}>
                Sair
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}