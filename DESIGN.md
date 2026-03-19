# Words Left Unsent — Template Design System

## Brand Foundation

| Element | Value |
|---------|-------|
| Primary font (labels/UI) | Poppins (sans-serif) |
| Content font (messages) | Georgia, "Times New Roman", serif |
| Brand color | #9c7a65 (warm taupe) |
| Domain | wordsleftunsent.com |
| Tagline | The messages we never sent. |

## Color Families

### Warm Family
Used by templates with warm, intimate tones.
- Background dark: `#0a0908`
- Text warm white: `#f0e8e0`
- Accent gold: `rgba(200, 168, 130)`
- Label gold: `rgba(220, 190, 150)`
- Classic beige: `#d4c4b0` → `#a8907a`
- Classic text dark: `#2a1f18`

### Cool/Dark Family
Used by templates with raw, confessional tones.
- Pure black: `#000000`
- Terminal text: `#d4e8d4` (green-tinted white)
- POV white: `#ffffff`
- POV accent: `rgba(220, 190, 150, 0.95)`

### Mood-Mapped Colors (TextOnGradient)
Each mood has a distinctive background color:
- Tender: `#e8b4b8` (soft pink)
- Regretful: `#8ba4b8` (dusty blue)
- Hopeful: `#d4a574` (warm amber)
- Bittersweet: `#b8a0c8` (muted lavender)
- Raw: `#c46060` (deep red)

Text on mood colors: `#1a1a1a` (dark, for contrast).

## Template Inventory

### Emotional Spectrum

```
CLEAN/VIRAL ←─────────────────────────────────→ CINEMATIC/MOODY

TextOnGradient  Handwritten  Typewriter  POV  Cinematic
(quick hit)     (personal)   (raw)       (bold) (sweeping)

                Classic      Modern     VoiceNarration
                (warm)       (contemplative) (intimate)
```

### Template Specifications

| Template | Content Font | Size | Background | Reveal | Tone |
|----------|-------------|------|------------|--------|------|
| Cinematic | Georgia serif | 68px | Video + overlay | Word-by-word blur | Moody, cinematic |
| POV | Poppins bold | 72px | Dark gradient | Full scale | Bold, direct |
| Classic | Georgia serif | 62px | Warm beige gradient | Char-by-char | Warm, intimate |
| Modern | Georgia serif | 54px | Dark breathing | Word-by-word glow | Contemplative |
| TextOnGradient | Poppins 600 | 72px | Solid mood color | Static (no animation) | Clean, viral |
| Typewriter | JetBrains Mono | 56px | Pure black | Char-by-char | Raw, confessional |
| Handwritten | Caveat | 64px | Parchment cream | Fade in | Personal, discovered |
| VoiceNarration | Poppins 400 | 62px | Dark + warm glow | Word-synced to TTS | Intimate, confessional |

### Max Content Length Per Template

| Template | Max Chars | Reason |
|----------|----------|--------|
| Cinematic | 160 | Georgia 68px, 1.65 line-height, generous padding |
| POV | 160 | Poppins bold 72px, centered |
| Classic | 160 | Georgia 62px with decorative elements |
| Modern | 160 | Georgia 54px, smaller but word-by-word needs space |
| TextOnGradient | 120 | Larger font (72px), fewer lines = bolder presence |
| Typewriter | 180 | Monospace 56px is compact, minimal padding |
| Handwritten | 140 | Caveat is wider per character |
| VoiceNarration | unlimited | Duration adapts to content length |

## Shared Visual DNA

All templates share these elements (extracted to `template-utils.ts`):

### Film Grain / Paper Grain
- SVG noise filter overlay
- Opacity: 3-6% (film grain) or 6% (paper grain for Classic/Handwritten)
- Blend mode: `overlay` (dark bg) or `multiply` (light bg)

### Vignette
- `radial-gradient(ellipse at center, transparent 30-50%, rgba(0,0,0,0.4-0.6) 100%)`
- Adds depth, focuses attention on center content

### Accent Line
- `linear-gradient(90deg, transparent, {accent-color}, transparent)`
- Width: 150-200px, animated from 0
- Used by: Cinematic, POV, Modern, Classic (NOT TextOnGradient, Typewriter, Handwritten)

### CTA Section
- Position: absolute bottom (250-280px from bottom in vertical)
- Line 1: "Share your unsent message" — Poppins 28-30px, weight 300
- Line 2: "wordsleftunsent.com" — Poppins/Georgia 38-42px, weight 400-600
- Exception: Handwritten uses subtle watermark style instead

### Hook Text (Frame 0)
- Visible immediately for thumbnail/scroll-stop
- Cinematic: first ~5 words + "..." in italic Georgia
- POV: "POV: you never sent this message" in Poppins bold
- TextOnGradient: full message (the simplicity IS the hook)
- Typewriter: blinking cursor on empty screen
- Handwritten: "Dear [name]," in Caveat
- VoiceNarration: audio starts + first word appears

### Attribution
- Format: "— [from]" in uppercase, letter-spaced (4-8px)
- Font: Poppins, weight 300, color matches template accent
- Exception: Handwritten uses "Always, [from]" in Caveat italic

## Animation Conventions

- **Easing:** `Easing.out(Easing.cubic)` for all entrances
- **Slide-up distance:** 12-30px (not more)
- **Fade duration:** 15-25 frames (0.5-0.8s)
- **Accent line grow:** 20-40 frames from 0 to full width

## TTS Voice Configuration

- Engine: Edge TTS (free, no API key)
- Default voice: `en-US-AriaNeural`
- Mood-variant styles:
  - tender → `whispering`
  - regretful → `sad`
  - hopeful → `hopeful`
  - bittersweet → `sad`
  - raw → `angry`

## Layout Constants (Vertical — 1080x1920)

| Element | Value |
|---------|-------|
| Content padding | 250-300px top, 350-400px bottom, 70-120px sides |
| CTA bottom offset | 250-280px |
| Max content width | 820-900px |
| Label letter-spacing | 4-8px |
| Label text-transform | uppercase |
