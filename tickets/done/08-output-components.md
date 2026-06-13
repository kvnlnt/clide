# Ticket 08 — Output Components

## Goal
Build the set of inline output viewer components that render script results directly in the thread below the form card that produced them.

## Acceptance criteria
- Output renders inline in the thread immediately below the collapsed FormCard that produced it
- The correct viewer is chosen based on the form's `outputType` field
- All viewers handle a loading/streaming state (data arriving in chunks) and a final/complete state
- Output is scrollable if taller than a reasonable max-height (400px default, expandable)
- Each output viewer has a toolbar with: copy-to-clipboard, open-in-external (where applicable), expand/collapse

## Output types & viewer specs

### `text`
- Monospaced font (Menlo / system mono), 13px, `rgba(255,255,255,0.8)` on `#0a0a0a` bg
- Streaming: appends lines in real-time
- stderr shown in `rgba(255,100,100,0.8)` color

### `table`
- Accepts: JSON array-of-objects, CSV, or TSV from stdout
- Renders as a data table: sticky header row, alternating row shading, sortable columns (click header)
- Columns sized to content, horizontal scroll if overflow
- Row count shown in toolbar: "42 rows"

### `image`
- Accepts: file path written to stdout by the script
- Renders the image centered, max-width 100%, max-height 400px, click to expand to full size
- Supports: PNG, JPG, GIF, WebP, SVG

### `audio`
- Accepts: file path to audio file
- Renders a custom minimal audio player: waveform or progress bar, play/pause, time display
- Formats: MP3, WAV, M4A, OGG

### `video`
- Accepts: file path to video file
- Renders an inline video player with play/pause, scrubber, volume
- Formats: MP4, MOV, WebM

### `json`
- Renders a collapsible JSON tree viewer
- Top-level keys are expanded by default; nested objects collapsed

## Component structure
```
OutputBlock
  OutputToolbar
  TextOutput | TableOutput | ImageOutput | AudioOutput | VideoOutput | JsonOutput
```

## Props
```ts
interface OutputBlockProps {
  runId: string
  outputType: OutputType
  status: RunStatus
  chunks: OutputChunk[]     // for streaming text
  outputPath?: string       // for file-based outputs (image/audio/video)
}
```

## Files to create
- `src/mainview/components/output/OutputBlock.tsx`
- `src/mainview/components/output/OutputToolbar.tsx`
- `src/mainview/components/output/TextOutput.tsx`
- `src/mainview/components/output/TableOutput.tsx`
- `src/mainview/components/output/ImageOutput.tsx`
- `src/mainview/components/output/AudioOutput.tsx`
- `src/mainview/components/output/VideoOutput.tsx`
- `src/mainview/components/output/JsonOutput.tsx`
