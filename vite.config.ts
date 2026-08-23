import { defineConfig } from 'vite'

/* HACS liefert genau EINE Datei aus (D-005). Deshalb kein Code-Splitting,
   keine externen Chunks und kein separates CSS: alles landet im Bundle. */
export default defineConfig({
  build: {
    target: 'es2021',
    lib: {
      entry: 'src/skytech-power-flow-card.ts',
      formats: ['es'],
      fileName: () => 'skytech-power-flow-card.js',
    },
    // Genau eine Ausgabedatei, kein dynamischer Nachlader.
    codeSplitting: false,
    // Keine Sourcemap: HACS und das GitHub-Release liefern genau die eine
    // Datei aus, eine nicht mitgelieferte Karte wäre totes Gewicht.
    sourcemap: false,
    emptyOutDir: true,
  },
})
