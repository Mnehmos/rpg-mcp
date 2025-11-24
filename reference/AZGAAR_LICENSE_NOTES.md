# Azgaar Fantasy Map Generator - License & Attribution

## Source Repository
- **Project**: Fantasy Map Generator
- **Author**: Max Haniyeu (Azgaar)
- **Repository**: https://github.com/Azgaar/Fantasy-Map-Generator
- **License**: MIT License
- **Copyright**: 2017-2024 Max Haniyeu (Azgaar), azgaar.fmg@yandex.com

## License Summary
The Azgaar Fantasy Map Generator is licensed under the MIT License, which permits:
- Use, modification, and distribution of the software
- Commercial use of derivative works
- Production of maps, images, screenshots, videos, and other materials without restriction

## Attribution Requirements
Per the MIT License, this notice must be included:
> Copyright 2017-2024 Max Haniyeu (Azgaar), azgaar.fmg@yandex.com
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.

## Usage in RPG MCP Server Project

### Reference Only
The Azgaar repository in `reference/azgaar/` is used as:
- **Algorithmic reference** for world generation techniques
- **Quality benchmark** for terrain, biome, and river generation
- **Inspiration** for procedural generation approaches

### What We Will NOT Reuse
- ❌ Direct code copying from Azgaar modules
- ❌ UI/rendering components
- ❌ Frontend-specific implementations
- ❌ Browser-based libraries and dependencies
- ❌ SVG/Canvas rendering logic

### What We WILL Reference
- ✅ **Algorithm concepts** (heightmap, climate, biome assignment)
- ✅ **Quality gates** (terrain continuity, river validity)
- ✅ **Data structures** (grid layouts, biome tables)
- ✅ **Parameter ranges** (elevation thresholds, temperature gradients)
- ✅ **Generation patterns** (layered noise, flow accumulation)

All implementations in the RPG MCP Server will be:
- Written from scratch in TypeScript
- Designed for server-side execution
- Schema-validated using Zod
- Deterministic and seedable
- Test-driven (TDD approach)

## Compliance Statement
This project complies with the MIT License by:
1. Including this attribution notice
2. Not claiming Azgaar's work as our own
3. Using the reference as inspiration, not direct copying
4. Implementing algorithms independently in our codebase
5. Maintaining clear separation between reference and implementation

## Contact
For questions about licensing or attribution:
- Azgaar: azgaar.fmg@yandex.com
- Original License: `reference/azgaar/LICENSE`
