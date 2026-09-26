# Voxel Hogwarts — Project Specification

A single self-contained web page that procedurally builds and renders a **voxel-art diorama of Hogwarts** (Harry Potter) at night. The castle and its grounds sit on a **massive, multi-tiered floating circular island** with sharp cuboid edges, surrounded by drifting voxel clouds, under a dark-blue starry sky with a voxel moon. The camera can move freely: WASD, mouse, wheel, keyboard zoom, isometric or perspective.

This document is written so that another LLM (or developer) can **re-create the project from scratch** without seeing the source code. Every number that matters is listed.

---

## 1. Deliverables & file layout

```
index.html          ← the finished single page (generated; open via any static HTTP server)
build.sh            ← concatenates src/* into index.html
src/00_head.html    ← <head>, CSS, import map, loader + HUD markup, opens <script type="module">
src/01_core.js      ← grid, constants, palette, noise, RNG, primitive shapes
src/02_terrain.js   ← floating island: height field, lake, cliffs, underside, waterfall
src/03_buildings.js ← architecture kit: hall(), roundTower(), squareTower(), bridge(), stairPath()
src/04_castle.js    ← Hogwarts layout (every building, placed from the reference plan)
src/05_grounds.js   ← forest, Quidditch pitch, Hagrid's hut, willow, stone circle, boats, squid, train
src/06_mesher.js    ← voxel → triangle mesher (face culling, AO, colour grain)
src/07_scene.js     ← renderer, sky, lights, materials, clouds, stars, moon, flying car, bloom
src/08_main.js      ← camera controls, build pipeline, render loop
src/99_tail.html    ← closes script/body/html
Vorlage/            ← reference images (mood renders, plan view, four elevations, film layout drawing)
```

The parts share one module scope (they're concatenated in order), so later files can use earlier globals directly. Splitting is only for editing convenience. The deliverable is the single `index.html`.

**Run:** `sh build.sh` then serve the folder (`python -m http.server 8731`) and open `http://localhost:8731/`. The page uses ES modules + an import map, so it needs HTTP rather than `file://`.

**Dependencies:** three.js **r160** from jsDelivr through an import map:
```json
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }
```
Addons used: `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`. No other libraries and no textures: everything is procedural.

---

## 2. Visual target (from the reference images)

- **Style:** Minecraft-like voxel diorama, "tiny perfectly aligned cubic blocks", crisp cube edges, **no anti-aliasing** (`antialias:false`, `image-rendering: pixelated`).
- **View:** high-angle **isometric** by default (orthographic camera, yaw ≈ 35.5°, pitch 35.26° = true isometric).
- **Mood:** gloomy midnight. The background is a vertical gradient `#050817 → #0b1336 → #15215a → #1c2a6a`. There's a cold blue moon light with **short, soft diagonal shadows** (PCF soft shadow map, light high and from the west). Warm orange lit windows and lanterns glow with bloom.
- **Palette:** warm grey-brown sandstone walls, **slate-blue roofs**, verdigris (copper-green) spire tips, dark green forest, deep blue lake, pale moonlit clouds.
- **Composition (mood refs `image*.png`):** castle on a rocky cliff, a lantern-lit staircase zig-zags down to a boathouse, a boat flotilla with candles on the lake, and clouds wrapping the island's base.
- **Layout refs:** `371-plan-view-overview-render.png` (top-down, north up, 2000 px) gives building footprints. The four elevations give heights and silhouettes. `plan-ss-2.png` is the film's general layout drawing (grounds, walls, labels).

---

## 3. World & coordinate system

| Constant | Value | Meaning |
|---|---|---|
| `W, H, D` | 288, 208, 288 | voxel grid size (x, y, z); `Uint8Array` of material ids (0 = air), ≈17 MB |
| index | `x + W*(z + D*y)` | y-major layers |
| `CX, CZ` | 144, 144 | island centre |
| `R` | 132 | island top radius (edge jittered ±2.5 by angular noise) |
| `LAKE_Y` | 63 | top water voxel |
| `BASE_Y` | 65 | lowest grass tier |
| `PLAT_Y` | 100 | castle floor (the plateau's top voxel is `PLAT_Y-1`) |
| grounds tier | `BASE_Y+18` = 83 | NW walled grounds + Quidditch pitch |
| scale `S` | 0.12 voxel per plan pixel | |

**Plan-pixel mapping** (the key trick for accuracy): building footprints are written directly in pixel coordinates of the 2000 px plan image and converted like this:
```js
PX = px => Math.round(CX + (px - 1100) * S);   // plan x → voxel x (east = +x)
PZ = py => Math.round(CZ + (py - 1080) * S);   // plan y → voxel z (south = +z)
```
Heights come from the elevations: 1 elevation pixel ≈ 1 plan pixel, so voxel height ≈ elevation px × 0.12.

---

## 4. Palette (material table)

`mat(hex, kind, vary)`: **kind** 1 = solid (Lambert), 2 = emissive (unlit + bloom), 3 = water (transparent Phong), 4 = glass (transparent Phong). **vary** is the ± brightness jitter per voxel ("grain").

| Name | Hex | kind | Use |
|---|---|---|---|
| STONE | #857563 | 1 | castle walls |
| STONE2 | #665a4d | 1 | plinths, string courses, foundations, pillars |
| STONE3 | #a1917b | 1 | trim, crenels, quoins, sills, paving |
| ROOF / ROOF2 | #33457e / #243260 | 1 | slate roof / ridge & eaves |
| COPPER | #4f9483 | 1 | spire tips |
| WIN / WIN2 | #ffa845 / #ffcf78 | 2 | lit windows (WIN2 = Great Hall) |
| WINDK | #1a2034 | 1 | dark window |
| GRASS / GRASS2 / MOSS | #3b5a2d / #2f4b27 / #46552f | 1 | ground |
| DIRT | #5a4532 | 1 | sub-soil |
| ROCK / ROCK2 / ROCK3 | #5d5852 / #4a4540 / #6e675e | 1 | cliffs (strata) |
| UNDER | #3a332e | 1 | island underside |
| WATER / FOAM | #1c3f78 / #9fc3e8 | 3 | lake, waterfall |
| GLASS | #86c7b4 | 4 | greenhouses |
| WOOD / WOOD2 / TRUNK | #5a3b22 / #7b5534 / #3a2a1b | 1 | bridges, boats, huts, trees |
| LEAF / LEAF2 / LEAF3 | #1f3b26 / #2b4b2b / #162c1e | 1 | foliage |
| LANT / CANDLE | #ffcf6b / #fff1c4 | 2 | lanterns, boat candles |
| PATH / GRAVEL / SAND | #7a7062 / #6b6357 / #8a7b5f | 1 | paths, beaches |
| GOLD | #d4a93a | 1 | Quidditch hoops, finials |
| RED / GREENH / BLUEH / YELL | #8e1f1f / #1f6b3a / #23408e / #c9a227 | 1 | house colours (stands) |
| PUMPK | #d9731c | 1 | Hagrid's pumpkins |
| PALEST | #9b978f | 1 | stone circle, Hagrid's hut |
| CLOCK | #e8dcb0 | 2 | clock faces |
| TRAINR / BLACK / IRON | #9b1b1b / #1b1b20 / #2b2b31 | 1 | Hogwarts Express, lamp posts, rails |
| CARB | #6d9cc2 | 1 | Ford Anglia |
| PLANT | #3f7a3a | 1 | greenhouse plants |
| SQUID | #3d2c44 | 1 | giant squid tentacles |
| CRYST | #6fb6ff | 2 | glowing crystals under the island |

Hex colours are converted to linear space with `new THREE.Color(hex)` before being written as vertex colours.

---

## 5. Noise & randomness

- `hash(x,y,z)`: integer hash (`Math.imul` mixing) → [0,1). Used for per-voxel grain, which windows are lit, and scatter.
- `vnoise(x,z)`: smooth 2D value noise. `fbm(x,z,oct=4)`: fractal sum.
- `mulberry32(seed)`: seeded RNG (`19910731` for placement), so the world is **deterministic**: the same diorama every load.

---

## 6. Terrain: the floating island (`02_terrain.js`)

1. **Regions** (each has a target top height, a cliff slope and a mask test in plan px):
   - `castle` → `PLAT_Y-1`, slope 2.6. It's the union of rectangles, oriented rectangles and circles covering every castle footprint: greenhouse compound (1110,430)-(1590,1035), north quad (945,585)-(1285,925), spine (1265,570)-(1435,1150), south block (1185,1025)-(1515,1185), apse (875,900)-(1095,1100), plaza (1090,900)-(1225,1030), NW wing oriented (835,640, −22°, ½L 150, ½W 95) + (890,700, 19°, 125, 55), connector (1025,365)-(1185,600), courtyard block (755,1160)-(1135,1515), astronomy circle (1100,1490, r115), Great Hall oriented (1125,1655, −34.9°, 240, 95), clock courtyard (405,1240)-(715,1435), stair head circle (1330,1600, r45). The **gaps** between masks become ravines under the bridges.
   - `grounds` → `BASE_Y+18`, slope 1.6, polygon [(1110,360),(1000,175),(890,125),(660,135),(520,330),(470,420),(560,520),(720,520),(950,560),(1070,560)].
   - `hagrid` hill (voxel circle (50,190) r≈8.4) → `BASE_Y+3`; `circle` hill ((30,160) r10) → `BASE_Y+4`; `boathouse` rock (1740,1600)-(1880,1790) → `LAKE_Y+2`.
2. **Distance field** per region: two-pass chamfer transform (1, √2) over the 288×288 mask.
3. **Column height** = max over: base ground `BASE_Y + floor(fbm*10-4)`; each region `h − drop`, where `drop = d × slope × (0.65+0.8·fbm)` is **quantized to 3-voxel terraces** (plus random 1-voxel ledges). This gives stepped, craggy cliffs.
4. **Lake**: `lakeField = (z−CZ) + 0.25(x−CX) − 36 + (fbm−0.5)·40`. Where it's > 0, the ground drops to `LAKE_Y−2 … LAKE_Y−9` and fills with water up to `LAKE_Y`. There's a beach band (`−5…0`) at `LAKE_Y+1`. A **stone lip** (`LAKE_Y+2`) runs along the rim, except a 3.5-voxel gap at `FALL = (CX+0.2R, CZ+0.98R)` where a **waterfall** spills over the edge. The waterfall falls to y≈4, curving outward (`out = √fallen·0.9`) and turning to foam.
5. **Underside**: bottom `yb = LAKE_Y − 6 − depth` with `depth = 8 + 46(1 − t^1.5) + fbm·12`, quantized to **6-voxel tiers**, where `t = dist/R`. The result is a thick vertical cuboid rim with an inverted stepped "wedding cake" below it. 70 stalactites (r 2–4.5, length 6–18) hang underneath, some with glowing crystal tips.
6. **Materials per voxel**: top voxel → grass/moss (flat), rock/moss (steep, neighbour drop > 2), sand (shore), dirt/rock (lake bed), rock3 (rim). 1–2 dirt under grass. Rock strata bands below (`(y + fbm·8) mod 9`), and underside strata below `LAKE_Y−8`.
7. `topY[x,z]` stores the terrain top for later placement.

---

## 7. Architecture kit (`03_buildings.js`)

All buildings are **functions of local coordinates**. `oriented2D(cx,cz,ang,hl,hw,fn)` iterates the world columns inside a rotated rectangle and hands the callback integer local coordinates `u` (along the length) and `v` (across), using nearest-neighbour rounding. That's how rotated buildings like the Great Hall and the NW wing stay crisp voxel art. `toWorld()` is the inverse.

### `hall(o)` — rectangular building
Options: `cx,cz,ang,hl,hw` (half sizes), `y0` (default `PLAT_Y`), `h` wall height, `roof: 'gable'|'hip'|'flat'`, `roofH` (default `hw+2`), `win: 'normal'|'gothic'|'none'`, `ev` window spacing (3), `floorH` (6), `buttress` spacing, `crenel`, `machi`, `dormers`, `litP` (fraction of lit windows), `stone/trim/roofMat`, `bright`, `arches` (open ground-floor arcade).
- **Foundation**: every footprint column drops `STONE2` down until it hits solid ground (up to 70 voxels). Buildings on cliff edges grow masonry plinths down the rock.
- **Walls**: interior solid. Corners are **quoins** (alternating STONE3/STONE2 every 2 rows). Rows 0–1 are a STONE2 plinth. A STONE2 string course runs at every floor.
- **Normal windows**: on the faces, at every `ev`-th position, not within 2 of a corner. Each floor has a sill (fy=1) and a 2-high window (fy=2,3). Lit if `hash < litP·0.72` (WIN), otherwise WINDK.
- **Gothic windows**: stacked 6-tall lancets with a trim transom every 9 rows.
- **Buttresses**: 1 voxel outside the long walls every `buttress` voxels, capped with trim.
- **Gable roof**: level k covers `|v| ≤ (hw+1)(1−k/roofH)`, with a 1-voxel eave overhang. It has ROOF2 eaves and ridge, stone gable ends with a small lit round window, and dormer slots (a lit window with a ROOF2 cap every 4 voxels along the slope at k = 2–3).
- **Hip roof**: also shrinks along u. With `hl == hw` it's a pyramid; a large `roofH` makes a spire with copper tip.
- **Flat roof**: battlements (alternating merlons) on the wall top or on the machicolation ring.

### `roundTower(o)`
`x,z,r,y0,h,cone,coneH (≈2.8r+3),crenel,machi,spire,winN`. It has a solid cylinder with a stone plinth and **slit windows** arranged by angle segment (`winN ≈ 1.4r`), stacked every 7 rows with sills. The machicolation ring (r+1) sits on the top 2 rows. The optional battlement ring is on top. The **stepped cone roof** has radius `R0·(1−k/coneH)^1.08`, where R0 = r+1.2 overhang (or r−0.6 inside the battlements). It has a ROOF2 eave ring and tiny lit dormer windows on the cone every 6 rows (8 per ring). The spire column ends in COPPER.

### `squareTower(o)`
A `hall` with `hl = hw = s` and a hip roof, plus optional **corner pinnacles**: a trim shaft, then a roof spike with a copper tip.

### `bridge(o)`
From (x0,z0) to (x1,z1) at deck height y, with width `w`. The deck (STONE3 or WOOD2) has parapets, optional lanterns, and an optional covered gable roof. Stone bridges have piers every `pierEvery` voxels, dropped to the ground, and shallow arch masonry in between. Wooden bridges (`truss:true`) have posts plus a **diagonal lattice** under the deck, like the covered wooden bridge in the elevations.

### `stairPath(pts, yA, yB, w, lantEvery)`
Walks a polyline and interpolates the height from yA to yB. It carves 5 voxels of headroom, drops STONE2 supports to the ground or lake bed (so it becomes a pier stair over water), adds side parapets, and puts **lantern posts** at intervals.

---

## 8. Castle layout (`04_castle.js`)

All coordinates are plan px (2000 px plan, north up). `h` = wall height in voxels above `PLAT_Y`. Towers are given as (centre, plan radius px → voxel radius = r·0.12).

**Greenhouse compound (NE)**
- Lawn (1120,450)-(1580,1020), gravel paths, and a low crenellated wall on the N and E edges.
- 8 glass greenhouses: (1130,470)-(1300,505), (1130,530)-(1300,560), (1395,470)-(1560,505), (1395,530)-(1560,560), (1470,580)-(1510,730), (1525,580)-(1565,730), (1470,745)-(1510,890), (1525,745)-(1565,890). Each has 3-high glass walls with iron posts every 4, a stepped glass roof with iron ribs, plants inside and one lantern.
- Octagonal glass pavilion at (1350,448): glass drum, stepped glass dome and a gold finial.

**North quadrangle**
- North range (960,605)-(1275,680): h24, dormers. West range (960,605)-(1030,915): h24.
- Cloister: a ring from (1032,682)-(1270,910) around the lawn (1060,700)-(1240,880), with pillars every 3, a stone slab and ROOF2 roof at +5/+6, a fountain at (1150,790), and 4 lamp posts.

**Spine & gothic towers**
- Spine (1275,590)-(1425,910): h26, roofH 11, buttress 4, dormers. Nave (1310,905)-(1390,1150): h22.
- Twin gothic towers at (1280,612) and (1410,612): s4, h40, spire roofH 24, gothic windows, pinnacles 9. Central gothic spire at (1345,598): s3, h36, roofH 34.
- South cross wing (1220,910)-(1500,1030): h24. Central tower (1350,958): s6, h34, roofH 16, pinnacles.
- South block (1225,1055)-(1500,1145): h22, buttress 3. Round towers: (1215,1062) r30 h30, (1480,1062) r30 h30, (1215,1142) r36 h26 battlements, (1480,1142) r36 h26.
- Fountain plaza (1095,905)-(1220,1025).

**West blocks**
- Hall (1000,915)-(1075,1030): h24. Hall (890,960)-(1000,1030): h20. Apse tower (945,1035): r55, h20, cone 13.
- Turrets (897,960) h27, (1000,953) h29, (945,920) h31.
- Stone bridge from (885,990) west to (575,968) with lanterns, ending at a gatehouse tower (560,966) r3 h10 on a masonry pillar.

**NW angled wing & grounds**
- Wing at (830,605): −22°, hl11, hw7, h28, dormers, buttress 3. Arm at (890,700): 19°, hl12, hw3, h20. Towers (848,745) h26 and (922,770) h24.
- Tall square tower (735,575): s3, h36, roofH 22, −22°.
- North connector building (1100,420): −25°, hl7, hw4, h14, with tower (1155,405) h20 and a covered passage (1080,465)-(1122,605) h12.
- Rampart (h6, crenellated, follows the terrain) along (1090,380)→(990,190)→(945,165)→(885,140)→(670,150)→(535,345)→(505,405). Turrets (r2.6, h12) at the vertices.
- **Owlery** at (505,405): r4.5, h30, cone 14, many dark slits.

**Courtyard block, Clock Tower & Astronomy Tower**
- Ranges: N (780,1180)-(1060,1265) h26 buttress 3; W (780,1180)-(860,1500) h26; S (780,1420)-(1040,1500) h24 with an open arcade; E (1040,1235)-(1120,1420) h26.
- Paved courtyard with a fountain at (950,1340) and 4 lamp posts.
- Towers (775,1182) r42 h32, (775,1495) r42 h30, (1105,1235) r45 h34, turrets (1000,1168), (1065,1168), (1060,1545).
- **Clock Tower** (795,1340): s5, h44, roofH 18, pinnacles. Gold-rimmed emissive clock faces with black hands on the W and E faces at +36.
- **Astronomy Tower** (1100,1490): r10, h44, machicolations + battlements, cone 42, spire 5. It's the tallest point (≈ y 192), with two small turrets clinging to the top (−7,−5) and (−4,−8).

**Clock-tower courtyard (W) & wooden bridge**
- Hall (595,1255)-(700,1420): h22, dormers. Crenellated curtain walls: N, S (h10), W (h12) with a gate. Corner turrets (425,1262) and (425,1412). Paved court with a fountain (525,1338).
- Covered stone passage (700→782, y 1340).
- **Covered wooden bridge**: truss, from (422,1340) west to (240,1340), ending in a small tower (232,1340).

**Great Hall**
- Centre (1125,1655), angle −34.9°, hl24, hw5, h28, roofH 10. Gothic lancets (WIN2, 90% lit), buttress 3, a paved terrace 2 voxels around.
- Round stair tower at local (8,8): r3, h34. A copper flèche on the ridge. Corner pinnacles at both gable ends.

**Bridges & stairs**
- Long lantern bridge (1340,1170)→(1250,1465) at plateau height.
- High covered link (1145,1215)→(1205,1160) at +12.
- **Boathouse staircase**: plan polyline (1330,1590)→(1370,1690)→(1470,1700)→(1500,1630)→(1600,1600)→(1690,1600)→(1760,1650), descending from the plateau to `LAKE_Y+2` with lanterns every 5.

**Boathouse** at (1805,1700): a hall along z (hl6, hw3, h8) at `LAKE_Y+3`, a round tower, two wooden piers with lanterns.

**Point lights** (≤ 14, warm `#ffa24d`, intensity 38·s, range 44, decay 1.3, flickering) sit at the fountains, courtyards, Great Hall, Astronomy Tower, boathouse and Hagrid's hut.

---

## 9. Grounds (`05_grounds.js`)

- **Quidditch pitch** on the grounds tier at plan (800,330). Elliptical (a24, b13), with mowing stripes every 3 voxels, a sand rim and a centre ring. 3 gold hoops per end (heights 9/12/9, ring r2). 10 stand towers in rotating house colours with pyramid caps and bleachers.
- **Hagrid's hut** at voxel (50,190) on its hill. Round stone hut r4 h5, a stepped thatch cone, lit windows, a chimney, a 3×3 pumpkin patch, a fence and a lamp.
- **Stone circle** (30,160): 11 standing stones on a ring of r6.
- **Whomping Willow** (72,150): 2×2 trunk and 9 arcing branches with drooping leaves.
- **Paths**: gravel lines from the wooden bridge to the stone circle and Hagrid, and toward the lake.
- **Forbidden Forest**: 9000 candidate points, with occupancy spacing of 3 (forest) or 4. Forest zone is the west third plus the north-west and south-west, masked by fbm > 0.33, 90% density. Elsewhere trees are sparse (6% low ground, 1.5% high). Pines are stepped cones with alternating ring widths; oaks are noisy ellipsoid crowns. Keep-clear zones cover the pitch, hut, circle, willow and station.
- **Cliff bushes**: 11% of rock/moss tops get a 3×2×3 leaf clump. Mid-height grass gets 3%.
- **Boats**: 2×4 flotilla on the lake around (168–200, 238–245). 5×3 wooden hulls with a candle post each.
- **Giant squid**: 4 arcing tentacles breaking the surface.
- **Hogwarts Express & Hogsmeade station** (east lower tier, x = 236, z 66–132): gravel bed, iron rails, sleepers, a platform with lamps and a wooden station house. The train has a black boiler with a red skirt, a chimney and headlamp, a red cab with lit windows, a tender, and 3 red carriages with lit windows and black roofs.
- The **flying Ford Anglia** is an animated object rather than grid voxels (see Section 11).

---

## 10. Meshing (`06_mesher.js`)

- The grid is split into **48³ chunks**. Each chunk produces up to four geometries (solid, emissive, water, glass).
- **Face culling**:
  - Opaque faces (solid/emissive) are emitted only against a non-opaque neighbour.
  - Water faces are emitted only against air or glass.
  - Glass faces are emitted only against air or water.
- **Face table**: normal n, axes u, v with u × v = n. Corners are o, o+u, o+u+v, o+v, which gives CCW winding from outside.
- **Voxel ambient occlusion** (opaque only): for each corner, sample side1, side2 and the corner voxel in the layer in front of the face. `ao = (s1&&s2) ? 0 : 3 − (s1+s2+c)`, mapped to `[0.42, 0.62, 0.80, 1.0]`. Emissive faces are clamped to ≥ 2. The quad diagonal flips when `ao0+ao2 < ao1+ao3` to avoid anisotropy.
- **Colour grain**: `linear colour × (1 + (hash−0.5)·2·vary) × AO`.
- **Compact buffers**: Int16 positions, Int8 normalized normals, Uint16 normalized colours, Uint32 indices. Growable per-kind buffers are reused across chunks.
- Result: ≈ 0.9 M triangles and ≈ 150 draw calls. The world builds in < 1 s on a desktop CPU.

---

## 11. Rendering (`07_scene.js`)

- `WebGLRenderer({antialias:false})`, pixel ratio ≤ 2, `PCFSoftShadowMap`, ACES filmic tone mapping at exposure 1.15.
- **Lights**:
  - Hemisphere `#5a6cc0` / `#1a1522`, intensity 1.1.
  - Ambient `#202848`, intensity 0.9.
  - **Moon**: DirectionalLight `#b4c4ff`, intensity 2.6. Its direction is `(MOON_SKY.x·0.6, 1, MOON_SKY.z·0.6)` normalized: the same compass direction (azimuth) as the visible moon, but steeper, so shadows stay short and fall away from the moon. It's placed 450 from the centre and casts shadows with a 4096² map, ortho shadow camera ±200, bias −0.0004, normalBias 0.35, radius 3.
- **Materials**:
  - Solid: `MeshLambertMaterial({vertexColors})`, casts and receives shadows.
  - Emissive: `MeshBasicMaterial({vertexColors, color:(1.9,1.9,1.9)})`. It's over-bright on purpose so it crosses the bloom threshold.
  - Water: Phong, opacity 0.8, shininess 90, specular `#5c74b8`, `depthWrite:false`.
  - Glass: Phong, opacity 0.5, faint green emissive.
- **Clouds**: 26 low clouds in a ring (radius R−12…R+28, y `LAKE_Y−52…LAKE_Y−12`) plus 4 high distant ones. Each is a union of 3–7 ellipsoids voxelized at **2-unit cells**, meshed with simple culling. Lambert `#8792b8`, opacity 0.62, emissive `#10162e`, no depth write. The whole group rotates slowly and each cloud bobs.
- **Stars**: 2200 points on a 1800-radius dome, size 1.6 px, not attenuated.
- **Moon**: a voxel sphere (r≈6 cells × 3 units) with over-bright basic material, fixed in the sky like a skybox object.
  - `MOON_SKY` is a constant world direction, 8° above the horizon and 45° left of the default view's back direction (default yaw 0.62). That puts it low in the west-northwest.
  - Each frame the moon is projected as a point at infinity. Its camera-space components are `lx = MOON_SKY·right`, `ly = MOON_SKY·up`, `lz = −MOON_SKY·dir`. It's hidden when `lz ≤ 0.05`.
  - Screen position: `ndc = (lx/lz / (tanV·aspect), ly/lz / tanV)`. `tanV` is `tan(fov/2)` in perspective mode. In isometric mode, which has no vanishing point, it's a wide virtual sky fov of `tan(55°)`.
  - It's placed at `target − dir·1400 + up·ndcY·halfH + right·ndcX·halfH·aspect` and scaled by `halfH/300`.
  - Result: panning and zooming leave it in place, rotating or tilting sweeps it across the sky, and buildings can hide it.
  - **Don't** attach it to a fixed screen offset. That makes it follow the camera.
- **Flying Ford Anglia**: a separate voxel model built from `miniMesh()` groups, scaled 1.3. Front is +z.
  - Model: 4×8 chassis in light blue `#6d9cc2`, chrome bumpers `#b8bec6`, a 2-row cabin (window band `#2c3a5a` with body-coloured corner pillars), a blue roof, 4 black tyres, over-bright headlights (2.4, 2.2, 1.5) and red tail lights. It casts shadows and carries a warm PointLight (45, range 45) 9 units ahead as its headlight beam.
  - Flight path (every frame): `θ += 0.1·dt`, position `(148 + 98 cos θ, PLAT_Y + 50 + 10 sin 2θ + 3 sin 3θ, 145 + 95 sin θ)`. This is an ellipse around the castle with slow swoops.
  - Bob: `1.2 sin(2.4t) + 0.3 sin(5.3t)` added to y.
  - Orientation: `lookAt` a point slightly ahead on the path, then `rotateZ(0.16 + 0.1 sin 1.7t)` (bank into the turn plus side-to-side wobble) and `rotateX(0.07 sin(2.4t+1))` (nose bob).
  - The path was checked against the voxel grid (a ±7 horizontal, −4…+9 vertical box, sampled 1440 times per loop) and clears every tower and spire.
- **Post**: `RenderPass → UnrealBloomPass(strength 0.7, radius 0.35, threshold 0.85) → OutputPass`.

---

## 12. Camera & controls (`08_main.js`)

State: `target`, `yaw`, `pitch`, `dist` (smoothed toward `distGoal`), `ortho` flag.
The view direction is `(sin yaw·cos pitch, sin pitch, cos yaw·cos pitch)`.

- **Isometric (default)**: OrthographicCamera, half-height `dist × 0.42`, positioned `target + dir·1500`. Default target (CX+4, PLAT_Y−4, CZ+4), yaw 0.62, pitch 0.6155, dist 330. The view looks NNW from the lake side, with the boats in the foreground like the mood reference.
- **Perspective (P)**: PerspectiveCamera, fov 45, positioned `target + dir·dist`. Zoom can go right in between the towers (dist ≥ 6).

| Input | Action |
|---|---|
| W / S | move forward/back (horizontal in isometric; along the view ray in perspective = fly) |
| A / D | strafe |
| R / F (Space / C) | raise / lower |
| Q / E, ← / → | rotate yaw |
| ↑ / ↓ | tilt pitch (0.03 … 1.5 rad) |
| + / −, Z / X, PgUp / PgDn, mouse wheel | zoom (dist 6 … 900) |
| Left drag | orbit |
| Right / middle drag, Shift+drag | pan in the screen plane |
| Touch | 1 finger orbits, 2 fingers pinch-zoom and pan |
| P | toggle isometric ⇄ perspective |
| T | auto-orbit |
| 0 / Home | reset view |
| H | collapse help panel |
| Shift (held) | 3× speed |

Movement speed scales with zoom: `max(12, dist·0.75)` units/s.

---

## 13. Build pipeline & loop

`main()` runs these steps, yielding with `setTimeout(0)` between them so the loader's progress bar updates:
1. `buildTerrain()`
2. `buildCastle()`
3. `buildGrounds()`
4. `addChunkMeshes()`, chunk by chunk with progress
5. `buildClouds()`
6. `addPointLights()`
7. start the loop

The loop runs `applyKeys(dt)`, `updateCamera()`, cloud drift, `updateFlyingCar(t, dt)`, light flicker, then `composer.render()`. A small stats readout shows fps, triangle count and mode. `window.hogwarts = { view, scene, get, PAL }` is exposed for debugging.

**Order matters**: terrain first, so `topY` exists; then buildings, whose foundations drop onto the terrain; then stairs, which carve through; then grounds, which query the final surface with `surf()`.

---

## 14. Suggested prompt sequence to re-create with another LLM

1. "Create `01_core.js`: a 288×208×288 Uint8 voxel grid with set/get, palette table (Section 4), hash/value-noise/fbm/mulberry32, box/disk/cyl/dropFill/oriented2D/oriented/toWorld/line3 primitives, and the PX/PZ plan-pixel mapping."
2. "Create the floating island terrain exactly as in Section 6."
3. "Create the architecture kit from Section 7."
4. "Place the castle from Section 8" (paste the tables).
5. "Add the grounds from Section 9."
6. "Write the chunked mesher with AO from Section 10."
7. "Set up rendering (Section 11) and controls (Section 12), and the loader/HUD page shell (Section 1)."
8. Iterate visually. Take screenshots from the default view, a low side view, and a close perspective view. Tune `litP` (overall ×0.72), bloom and cloud opacity.

## 15. Tuning knobs & known limitations

- **Gloom level**: the `litWin` multiplier (0.72), `renderer.toneMappingExposure`, moon intensity, emissive colour multiplier (1.9), bloom strength and threshold.
- **Detail**: `S` (plan scale). Raising it to 0.15 gives more detailed buildings but needs a larger grid, and triangles grow roughly with S².
- **Performance**: the shadow map size (4096) and pixel ratio are the main GPU costs. The grid is static; nothing is re-meshed at runtime.
- The castle is a stylised interpretation of the plan and elevations. Interiors are solid, and the camera can clip into walls in perspective mode.
- Water is static (no waves), and the clouds are simple translucent voxel blobs.
