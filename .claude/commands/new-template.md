---
name: new-template
description: Scaffold a new Remotion video template
---

## Steps

1. Ask for template name and visual style description

2. Use the video-designer agent to create the template component at:
   `packages/content-engine/src/templates/<name>.tsx`

3. Register the template in `packages/content-engine/src/compositions/Root.tsx`

4. Create a preview render to verify it works:
   ```bash
   cd packages/content-engine && npx remotion preview
   ```

5. Add the template to the template registry
