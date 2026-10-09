interface ItemImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Llena todo el bloque sin recortar la imagen: una copia de fondo,
 * agrandada y difuminada, cubre el cuadro entero (nada de gris vacío),
 * y encima va la imagen real completa, sin cortar ningún borde. Mismo
 * truco que usan Spotify/Apple Music para portadas que no son cuadradas.
 */
export default function ItemImage({ src, alt, className = "" }: ItemImageProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-60"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="relative z-10 w-full h-full object-contain"
      />
    </div>
  );
}
