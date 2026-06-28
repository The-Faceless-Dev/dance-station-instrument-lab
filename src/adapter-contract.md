# Host Adapter Contract

The shared Instrument Lab must not hardcode standalone FastAPI or site IndexedDB behavior.

Adapters should provide these methods as extraction proceeds:

```ts
interface InstrumentLabAdapter {
  listAudioAssets(): Promise<AudioAsset[]>;
  resolveAudioAsset(assetId: string): Promise<{ url: string; title: string }>;
  listInstrumentClips(): Promise<InstrumentClip[]>;
  saveInstrumentClip(payload: SaveInstrumentPayload): Promise<InstrumentClip>;
  loadInstrumentBank(): Promise<InstrumentBank>;
  importSfz?(payload: SfzImportPayload): Promise<InstrumentDefinition>;
  notify?(message: string, kind?: "info" | "success" | "warning" | "error"): void;
}
```

Standalone adapter:

- existing local API endpoints
- local creation assets
- local instrument bank and SFZ import endpoints

Site adapter:

- IndexedDB/private assets
- public/imported library assets
- browser-only save/export paths
- feature gates for backend-only instrument import
