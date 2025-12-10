/**
 * terrain-patterns.ts
 * 
 * Procedural terrain pattern generators for consistent geometric layouts
 * Used by generate_terrain_patch and generate_terrain_pattern tools
 */

export interface TerrainPatternResult {
  obstacles: string[];      // "x,y" format
  water: string[];
  difficultTerrain: string[];
  props: Array<{
    position: string;
    label: string;
    heightFeet: number;
    propType: string;
    cover: string;
  }>;
}

/**
 * Generate a river valley pattern
 * Two parallel cliff walls with a wide river in the center
 */
export function generateRiverValley(
  originX: number,
  originY: number,
  width: number,
  height: number
): TerrainPatternResult {
  const obstacles: string[] = [];
  const water: string[] = [];
  
  // Calculate wall positions (at edges) and river center
  const westWallX = originX + 2;
  const eastWallX = originX + width - 3;
  const riverStartX = originX + Math.floor(width / 2) - 1;
  const riverWidth = 3;
  
  // Generate west cliff wall
  for (let y = originY; y < originY + height; y++) {
    obstacles.push(`${westWallX},${y}`);
    // Add some depth to cliff (2 tiles wide)
    obstacles.push(`${westWallX + 1},${y}`);
  }
  
  // Generate east cliff wall
  for (let y = originY; y < originY + height; y++) {
    obstacles.push(`${eastWallX},${y}`);
    obstacles.push(`${eastWallX - 1},${y}`);
  }
  
  // Generate river (3 tiles wide in center)
  for (let y = originY; y < originY + height; y++) {
    for (let dx = 0; dx < riverWidth; dx++) {
      water.push(`${riverStartX + dx},${y}`);
    }
  }
  
  // Add cliff props
  const props = [
    { position: `${westWallX},${originY + 2}`, label: 'West Cliff', heightFeet: 30, propType: 'structure', cover: 'full' },
    { position: `${eastWallX},${originY + 2}`, label: 'East Cliff', heightFeet: 30, propType: 'structure', cover: 'full' },
  ];
  
  return { obstacles, water, difficultTerrain: [], props };
}

/**
 * Generate a canyon pattern (horizontal walls)
 * Two parallel walls running east-west with a pass between
 */
export function generateCanyon(
  originX: number,
  originY: number,
  width: number,
  height: number
): TerrainPatternResult {
  const obstacles: string[] = [];
  
  // Calculate wall positions
  const northWallY = originY + 3;
  const southWallY = originY + height - 4;
  
  // Generate north wall
  for (let x = originX; x < originX + width; x++) {
    obstacles.push(`${x},${northWallY}`);
    obstacles.push(`${x},${northWallY - 1}`);
  }
  
  // Generate south wall
  for (let x = originX; x < originX + width; x++) {
    obstacles.push(`${x},${southWallY}`);
    obstacles.push(`${x},${southWallY + 1}`);
  }
  
  const props = [
    { position: `${originX + Math.floor(width/2)},${northWallY}`, label: 'North Canyon Wall', heightFeet: 25, propType: 'structure', cover: 'full' },
    { position: `${originX + Math.floor(width/2)},${southWallY}`, label: 'South Canyon Wall', heightFeet: 25, propType: 'structure', cover: 'full' },
  ];
  
  return { obstacles, water: [], difficultTerrain: [], props };
}

/**
 * Generate an arena pattern
 * Circular wall perimeter enclosing an open area
 */
export function generateArena(
  originX: number,
  originY: number,
  width: number,
  height: number
): TerrainPatternResult {
  const obstacles: string[] = [];
  
  const centerX = originX + Math.floor(width / 2);
  const centerY = originY + Math.floor(height / 2);
  const radius = Math.min(width, height) / 2 - 2;
  
  // Generate circular perimeter using Bresenham's circle algorithm approximation
  for (let angle = 0; angle < 360; angle += 5) {
    const rad = angle * Math.PI / 180;
    const x = Math.round(centerX + radius * Math.cos(rad));
    const y = Math.round(centerY + radius * Math.sin(rad));
    const key = `${x},${y}`;
    if (!obstacles.includes(key)) {
      obstacles.push(key);
    }
  }
  
  const props = [
    { position: `${centerX},${originY + 1}`, label: 'Arena North Gate', heightFeet: 15, propType: 'structure', cover: 'three-quarter' },
    { position: `${centerX},${originY + height - 2}`, label: 'Arena South Gate', heightFeet: 15, propType: 'structure', cover: 'three-quarter' },
  ];
  
  return { obstacles, water: [], difficultTerrain: [], props };
}

/**
 * Generate a mountain pass pattern
 * Narrowing corridor toward the center
 */
export function generateMountainPass(
  originX: number,
  originY: number,
  width: number,
  height: number
): TerrainPatternResult {
  const obstacles: string[] = [];
  const difficultTerrain: string[] = [];
  
  const centerY = originY + Math.floor(height / 2);
  
  // Generate narrowing walls
  for (let y = originY; y < originY + height; y++) {
    const distFromCenter = Math.abs(y - centerY);
    const wallOffset = Math.floor(distFromCenter / 3) + 3;
    
    // Left wall (narrows toward center)
    obstacles.push(`${originX + wallOffset},${y}`);
    
    // Right wall (mirrors left)
    obstacles.push(`${originX + width - wallOffset - 1},${y}`);
    
    // Add difficult terrain near walls (scree/rocks)
    if (distFromCenter > 2) {
      difficultTerrain.push(`${originX + wallOffset + 1},${y}`);
      difficultTerrain.push(`${originX + width - wallOffset - 2},${y}`);
    }
  }
  
  const props = [
    { position: `${originX + Math.floor(width/2)},${centerY}`, label: 'Pass Chokepoint', heightFeet: 5, propType: 'cover', cover: 'half' },
  ];
  
  return { obstacles, water: [], difficultTerrain, props };
}

/**
 * Generate a maze using recursive backtracking algorithm
 * Creates a proper maze with corridors and walls
 */
export function generateMaze(
  originX: number,
  originY: number,
  width: number,
  height: number,
  seed?: string,
  corridorWidth: number = 1
): TerrainPatternResult {
  const obstacles: string[] = [];

  // Seeded random for reproducibility
  const seedNum = seed ? seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : Date.now();
  let rngState = seedNum;
  const random = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  // Scale maze cells based on corridor width
  const cellSize = corridorWidth + 1; // wall + corridor
  const mazeWidth = Math.floor((width - 1) / cellSize);
  const mazeHeight = Math.floor((height - 1) / cellSize);

  // Initialize all cells as walls
  const grid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(true));

  // Carve out the maze using recursive backtracking
  const stack: [number, number][] = [];
  const visited: boolean[][] = Array(mazeHeight).fill(null).map(() => Array(mazeWidth).fill(false));

  // Start from center-ish
  const startCellX = Math.floor(mazeWidth / 2);
  const startCellY = Math.floor(mazeHeight / 2);

  // Convert cell coords to grid coords
  const cellToGrid = (cx: number, cy: number): [number, number] => {
    return [originX + 1 + cx * cellSize, originY + 1 + cy * cellSize];
  };

  // Carve a cell (make it passable)
  const carveCell = (cx: number, cy: number) => {
    const [gx, gy] = cellToGrid(cx, cy);
    for (let dy = 0; dy < corridorWidth; dy++) {
      for (let dx = 0; dx < corridorWidth; dx++) {
        if (gy + dy < originY + height && gx + dx < originX + width) {
          grid[gy + dy - originY][gx + dx - originX] = false;
        }
      }
    }
  };

  // Carve passage between two adjacent cells
  const carvePassage = (cx1: number, cy1: number, cx2: number, cy2: number) => {
    const [gx1, gy1] = cellToGrid(cx1, cy1);
    const [gx2, gy2] = cellToGrid(cx2, cy2);

    // Carve the wall between cells
    const midX = Math.min(gx1, gx2) + (cx1 !== cx2 ? corridorWidth : 0);
    const midY = Math.min(gy1, gy2) + (cy1 !== cy2 ? corridorWidth : 0);

    for (let dy = 0; dy < corridorWidth; dy++) {
      for (let dx = 0; dx < corridorWidth; dx++) {
        const y = (cy1 === cy2) ? gy1 + dy - originY : midY + dy - originY;
        const x = (cx1 === cx2) ? gx1 + dx - originX : midX + dx - originX;
        if (y >= 0 && y < height && x >= 0 && x < width) {
          grid[y][x] = false;
        }
      }
    }
  };

  // Get unvisited neighbors
  const getNeighbors = (cx: number, cy: number): [number, number][] => {
    const neighbors: [number, number][] = [];
    const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < mazeWidth && ny >= 0 && ny < mazeHeight && !visited[ny][nx]) {
        neighbors.push([nx, ny]);
      }
    }
    return neighbors;
  };

  // Start carving
  visited[startCellY][startCellX] = true;
  carveCell(startCellX, startCellY);
  stack.push([startCellX, startCellY]);

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = getNeighbors(cx, cy);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      // Pick random neighbor
      const [nx, ny] = neighbors[Math.floor(random() * neighbors.length)];
      visited[ny][nx] = true;
      carveCell(nx, ny);
      carvePassage(cx, cy, nx, ny);
      stack.push([nx, ny]);
    }
  }

  // Convert grid to obstacle coordinates
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x]) {
        obstacles.push(`${originX + x},${originY + y}`);
      }
    }
  }

  return { obstacles, water: [], difficultTerrain: [], props: [] };
}

/**
 * Generate a maze with rooms (chambers connected by corridors)
 */
export function generateMazeWithRooms(
  originX: number,
  originY: number,
  width: number,
  height: number,
  seed?: string,
  roomCount: number = 5,
  minRoomSize: number = 4,
  maxRoomSize: number = 8
): TerrainPatternResult {
  // First generate base maze
  const baseMaze = generateMaze(originX, originY, width, height, seed, 1);
  const obstacles = new Set(baseMaze.obstacles);

  // Seeded random
  const seedNum = seed ? seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 1000 : Date.now();
  let rngState = seedNum;
  const random = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  // Carve out rooms
  const rooms: {x: number; y: number; w: number; h: number}[] = [];

  for (let i = 0; i < roomCount * 3 && rooms.length < roomCount; i++) {
    const rw = Math.floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const rh = Math.floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
    const rx = originX + Math.floor(random() * (width - rw - 2)) + 1;
    const ry = originY + Math.floor(random() * (height - rh - 2)) + 1;

    // Check overlap with existing rooms
    let overlaps = false;
    for (const room of rooms) {
      if (rx < room.x + room.w + 1 && rx + rw + 1 > room.x &&
          ry < room.y + room.h + 1 && ry + rh + 1 > room.y) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
      // Carve out the room
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          obstacles.delete(`${x},${y}`);
        }
      }
    }
  }

  // Add room props for navigation
  const props = rooms.map((room, i) => ({
    position: `${room.x + Math.floor(room.w/2)},${room.y + Math.floor(room.h/2)}`,
    label: `Chamber ${i + 1}`,
    heightFeet: 0,
    propType: 'marker',
    cover: 'none'
  }));

  return { obstacles: Array.from(obstacles), water: [], difficultTerrain: [], props };
}

/**
 * Get pattern generator by name
 */
export function getPatternGenerator(
  pattern: 'river_valley' | 'canyon' | 'arena' | 'mountain_pass' | 'maze' | 'maze_rooms'
): (originX: number, originY: number, width: number, height: number, seed?: string) => TerrainPatternResult {
  switch (pattern) {
    case 'river_valley': return generateRiverValley;
    case 'canyon': return generateCanyon;
    case 'arena': return generateArena;
    case 'mountain_pass': return generateMountainPass;
    case 'maze': return generateMaze;
    case 'maze_rooms': return (ox, oy, w, h, s) => generateMazeWithRooms(ox, oy, w, h, s);
    default: return generateCanyon;
  }
}

export const PATTERN_DESCRIPTIONS = {
  river_valley: 'Parallel cliff walls on east/west edges with 3-wide river in center',
  canyon: 'Two parallel walls running east-west with open pass between',
  arena: 'Circular wall perimeter enclosing an open fighting area',
  mountain_pass: 'Narrowing corridor toward center, wider at edges',
  maze: 'Procedural maze using recursive backtracking - dense corridors',
  maze_rooms: 'Maze with carved-out rooms/chambers connected by corridors'
};
