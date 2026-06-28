# Dance Station Instrument Lab

Shared Instrument Lab module for Dance Station.

This repo is seeded from the working standalone implementation in `D:\autotransition`. The standalone app remains the source of truth until this package is extracted, verified, and then wired back into both hosts.

## Source Snapshot

`standalone-source/` is a verbatim copy of the current working standalone UI files:

- `index.html`
- `app.js`
- `styles.css`
- `instruments/`

Do not hand-recreate behavior from memory. Extract from this snapshot and keep behavior aligned with standalone.

## Target Shape

The shared module should expose a browser mount API and host adapter contract:

```js
mountInstrumentLab(rootElement, {
  adapter,
  initialState,
});
```

The adapter supplies host-specific behavior:

- list existing audio creations
- load audio asset URLs or blobs
- save rendered instrument tracks/clips
- show status/toast messages
- import user instruments where supported

Standalone and site hosts should use the same editor logic, piano roll, styles, and instrument assets.

## Safety Rule

Do not switch standalone Dance Station to this package until the shared module is verified. The current standalone implementation must keep working throughout extraction.
