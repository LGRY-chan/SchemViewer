# SchemViewer

SchemViewer is a fast, beautiful, and fully client-side 3D Minecraft `.litematic` schematic viewer that runs directly in the browser. Powered by the Deepslate WebGL engine, it processes schematic files completely offline, ensuring your data never leaves your browser.

Live deployment: [https://litematica.lgry.org](https://litematica.lgry.org)

## Features

- **Interactive 3D Renderer**: View schematics in real-time WebGL with responsive mouse drag rotation, zoom, and panning.
- **Y-Axis Slicer**: Adjust vertical slicing height to view specific layers of the schematic.
- **Regions Visibility Control**: Toggle individual subregion bounding boxes and visibility states.
- **Block Materials Checklist**: Filter, search, and check off block materials to keep track of resources.
- **Technical Mode**: Switch between default Minecraft textures and customized technical textures with the built-in atlas texture swap toggling.
- **Data Export**: Export your schematic block list and metadata to CSV or JSON formats.
- **100% Client-Side**: Safe, secure, and offline-compatible. No server uploading is required.

## Project Structure

- `index.html`: Core structure and UI layout.
- `assets/`: 
  - `vanilla/`: Default texture atlas and data mapping.
  - `tech/`: Technical texture atlas and data mapping for redstone/technical designs.
  - `deepslate-helpers.js`: Specialized WebGL structure rendering extension hook.
  - `opaque.js`: Definition list of opaque block properties.
- `js/`:
  - `parser.js`: Offline litematic file decompressor and data parser.
  - `entities.js`: Visual hitbox indicator positioning logic.
  - `controller.js`: Main UI layout bindings and user inputs coordinator.
  - `renderer-2d.js`: Canvas fallback renderer.
  - `renderer-3d.js`: WebGL deepslate scene orchestrator.
- `compile_atlas.js`: Utility script to pack custom atlas images into Base64 format for serverless environments.

## Local Development

To run SchemViewer locally:

1. Clone this repository.
2. Open `index.html` directly in any web browser.

If you make modifications to `assets/vanilla/atlas.png` or `assets/tech/atlas.png` and want to compile them:
```bash
node compile_atlas.js
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
