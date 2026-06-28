# Extraction Map

The first extraction target is the standalone Instrument Lab.

## HTML

From `standalone-source/index.html`:

- `#instrumentLabPage`
- track controls
- piano roll controls
- render controls
- instrument bank controls
- instrument clip list

## CSS

From `standalone-source/styles.css`:

- `.workspace.instrument-page.active`
- `.instrument-source-panel`
- `.instrument-editor-panel`
- `.instrument-output-panel`
- `.instrument-track-list`
- `.instrument-track-item`
- `.piano-roll-toolbar`
- `.piano-roll-scroll`
- `.instrument-piano-roll`
- `.instrument-piano-keys`
- `.piano-key`

## JS

From `standalone-source/app.js`:

- instrument state fields
- element refs
- instrument bank loading
- synth/sample scheduling
- playback/record transport
- render/save flow
- track list rendering
- clip list rendering
- project load/save payload
- piano-roll metrics, drawing, scroll, zoom, fit
- cursor placement and selection
- note create/move/resize/copy/paste/delete
- keyboard and piano input

## Extraction Rule

Prefer moving exact functions first, then replacing hardcoded host calls with adapter calls. Avoid rewriting behavior until both hosts use the shared module and tests/manual checks show parity.
