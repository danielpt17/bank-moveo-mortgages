import './HeroWave.css';
/**
 * Decorative coral brush-stroke band under the header, exported from Figma
 * (public/wave.png, 1920×300, drawn from the page top so the header covers its
 * first rows). Purely visual, hidden from assistive tech; the nav floats over it.
 */
export function HeroWave({ tall = false }: { tall?: boolean }) {
  return <div className={`hero${tall ? ' hero--tall' : ''}`} aria-hidden="true" />;
}
