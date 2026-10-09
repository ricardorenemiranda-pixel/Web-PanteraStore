import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Paleta "Apple-style" — ver .impeccable/surfaces/app.md ---
        // Pivote pedido explícitamente por el cliente: modo claro, fondo
        // casi blanco (no #fff puro), texto casi negro, un único acento de
        // marca (rojo) usado con moderación — nada de gradientes ni acento
        // secundario compitiendo. El resto de los tokens son derivados de
        // esos pocos colores base para que los componentes existentes
        // sigan funcionando con los mismos nombres de clase.
        // Paleta morada de marca — pedido explícito: nada de blanco de
        // fondo, morado para todo el sitio. Fondo casi negro con
        // trasfondo violeta (no negro puro), superficies violeta oscuro
        // en capas, texto lavanda clara. Acento único: un violeta
        // medio-claro (ni neón ni el "morado de IA" genérico) que
        // funciona como texto sobre el fondo oscuro Y como botón sólido
        // con texto oscuro encima (mejor contraste que texto blanco).
        "on-tertiary-container": "#f1edfa",
        "on-surface-variant": "#a99bc7",
        "surface-dim": "#100d1a",
        "tertiary-fixed-dim": "#c9a6e0",
        "surface-tint": "#b18ae8",
        "surface-container-low": "#1c1630",
        "surface-container": "#231c3d",
        "surface-container-lowest": "#100d1a",
        "on-surface": "#f1edfa",
        "on-secondary-container": "#f1edfa",
        "tertiary-container": "#2b2248",
        "surface-bright": "#3a2f5c",
        "on-tertiary-fixed": "#1c1630",
        surface: "#1c1630",
        "tertiary-fixed": "#f1edfa",
        "on-primary-container": "#f1edfa",
        "surface-container-highest": "#332853",
        "on-secondary": "#150e24",
        "inverse-primary": "#4a2f74",
        primary: "#b18ae8",
        "on-tertiary-fixed-variant": "#a99bc7",
        "secondary-container": "#332853",
        "surface-container-high": "#2b2248",
        tertiary: "#a99bc7",
        outline: "#453a66",
        "inverse-on-surface": "#150e24",
        "on-primary": "#150e24",
        "on-primary-fixed": "#150e24",
        "primary-container": "#3a2f5c",
        error: "#e0574a",
        "outline-variant": "#2e2650",
        secondary: "#c9a6e0",
        "on-secondary-fixed": "#150e24",
        "on-primary-fixed-variant": "#c9b3e6",
        "on-secondary-fixed-variant": "#f1edfa",
        "on-background": "#f1edfa",
        background: "#14101f",
        "secondary-fixed": "#150e24",
        "primary-fixed": "#3a2f5c",
        "primary-fixed-dim": "#b18ae8",
        "error-container": "#4a231e",
        "surface-variant": "#2b2248",
        "on-tertiary": "#f1edfa",
        "inverse-surface": "#f1edfa",
        "on-error-container": "#ffd9d2",
        "secondary-fixed-dim": "#c9a6e0",
        "on-error": "#150e24",
        // Rarezas oficiales de Valve — sin relación con la marca, no tocar.
        "rarity-common": "#B0C3D9",
        "rarity-uncommon": "#5E98D9",
        "rarity-rare": "#4B69FF",
        "rarity-mythical": "#8847FF",
        "rarity-legendary": "#D32CE6",
        "rarity-immortal": "#E4AE39",
        "rarity-arcana": "#ADE55C",
        "rarity-ancient": "#EB4B4B",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "64px",
        base: "8px",
        "container-max": "1440px",
        gutter: "24px",
      },
      fontFamily: {
        // Una sola familia (Manrope) para titulares y cuerpo — al estilo
        // Apple/SF Pro, donde la jerarquía la hace el peso y el tamaño, no
        // mezclar una tipografía "de exhibición" con otra "de cuerpo".
        // JetBrains Mono queda solo para datos alineados en columna
        // (rango de precio, código de referencia) con tabular-nums.
        "headline-sm": ["Manrope", "system-ui", "sans-serif"],
        "headline-md": ["Manrope", "system-ui", "sans-serif"],
        "headline-lg": ["Manrope", "system-ui", "sans-serif"],
        "headline-xl": ["Manrope", "system-ui", "sans-serif"],
        "headline-lg-mobile": ["Manrope", "system-ui", "sans-serif"],
        "body-lg": ["Manrope", "system-ui", "sans-serif"],
        "body-md": ["Manrope", "system-ui", "sans-serif"],
        "body-sm": ["Manrope", "system-ui", "sans-serif"],
        "price-display": ["Manrope", "system-ui", "sans-serif"],
        "label-caps": ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "headline-sm": ["19px", { lineHeight: "26px", fontWeight: "600", letterSpacing: "-0.015em" }],
        "headline-md": ["23px", { lineHeight: "29px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "headline-lg": ["36px", { lineHeight: "42px", fontWeight: "700", letterSpacing: "-0.025em" }],
        "headline-xl": ["64px", { lineHeight: "66px", letterSpacing: "-0.03em", fontWeight: "700" }],
        "headline-lg-mobile": ["32px", { lineHeight: "36px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "body-lg": ["19px", { lineHeight: "30px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "25px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "21px", fontWeight: "400" }],
        "price-display": ["20px", { lineHeight: "24px", fontWeight: "700", letterSpacing: "-0.01em" }],
        "label-caps": ["11px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};

export default config;
