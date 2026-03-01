# Project: Bilibili & YouTube Guitar Helper

## Description
A sophisticated userscript for Bilibili and YouTube designed to assist musicians in practicing. It provides precise video control, a modern UI, and deep integration with video players.

## Current State (v1.2)
The project is a fully functional userscript that injects a draggable, collapsible overlay into Bilibili and YouTube video players.

### Core Features
- **Advanced Looping**: 
  - Set start (`[`) and end (`]`) points with visual emerald green feedback and `MM:SS` timestamps.
  - Persistent loop toggle (`L`).
- **Preparation Countdown**:
  - 3-second countdown before playback starts.
  - **Auto-Seek**: If looping is on, seeks to the loop start point before counting down.
  - **Apple-Style UI**: Large, blurred-background overlay in the video center.
  - **Audio Feedback**: Programmatic "tick" and "go" sounds using the Web Audio API (toggleable via UI).
- **Precise Speed Control**: 
  - Adjust speed from 0.5x to 1.0x in 0.1 increments via buttons or `+/-` shortcuts.
- **Stealth Mode (Minimized UI)**:
  - Collapses to just a 🎸 emoji.
  - **Opacity Transition**: 0.1 opacity when idle; fades to 1.0 on hover.
  - **Right-Anchored**: Minimizes toward the top-right corner.

### Technical Implementation Details
- **UI Architecture**:
  - Pure Vanilla JS and CSS-in-JS.
  - **Glassmorphism**: Uses `backdrop-filter: blur(4px)` and semi-transparent backgrounds.
  - **Draggable**: Custom drag-and-drop implementation using the header as the handle.
- **Persistence**: 
  - Uses `localStorage` to save:
    - UI Position (`gh-right`, `gh-top`).
    - Minimized state (`gh-minimized`).
- **Keyboard Shortcuts (Capture Phase)**:
  - Uses the capture phase (`addEventListener(..., true)`) and `stopImmediatePropagation()` to hijack native shortcuts (like Bilibili's `[` and `]`) for our own features.
- **Platform Integration**: 
  - Injects into `.bpx-player-video-area`, `#movie_player`, or `.html5-video-player` to ensure visibility in fullscreen.
  - Uses a polling `init` function to wait for the `<video>` element in SPA environments (Bilibili/YouTube).

## Keyboard Shortcuts Summary
- `[` : Set Loop Start
- `]` : Set Loop End
- `l` : Toggle Loop On/Off
- `c` : Toggle Countdown On/Off
- `-` : Playback Speed Down
- `+` / `=` : Playback Speed Up

## Development Guidelines
- **Metadata**: Always keep `@version` in sync with changes.
- **UI Integrity**: Maintain the right-anchored positioning logic when modifying the UI or drag system.
- **Shortcuts**: Always use the capture phase when adding shortcuts to avoid platform native conflicts.

---
*Generated and maintained by Gemini CLI.*
