# Libraries

[Syntax reference](README.md) · [Lines and math](basics.md) · [Conditionals, actions and enums](logic.md) · [Styles](styles.md) · [Components](components.md) · [Lambdas, macros and loops](macros.md) · **Libraries** · [Blocks and settings](blocks.md) · [What the compiler adds, and From graph](round-trip.md) · [Errors and warnings](errors.md)

## Libraries

A library is a `.tmcpp` file of definitions that other files `import`. The compiler resolves imports itself; nothing is pasted in. A library may only define **components, macros, classes, colours, functions and constants**. A line that draws or a slider is an error there, since it would have nowhere to go: wrap it in a component, and the importing file decides where it appears with `new`.

```js
// springs: a library
color steel #6b7b8c
class spring { #steel width 2 }
lerp(a, b, t) = a + (b - a) * t
component Spring(A, B, coils = 8) {
  d = B - A
  w = (-d.y, d.x) / distance(A, B) * 0.3
  lerp(A, B, t) + sin(2 * pi * coils * t) * w  .spring
}
```

Three ways to import it:

| Form | Brings in | Written as |
| --- | --- | --- |
| `import "springs"` | everything, unprefixed | `new Spring(...)`, `lerp(...)`, `.spring`, `#steel` |
| `import "springs" as sp` | everything, behind the name | `new sp.Spring(...)`, `sp.lerp(...)`, `.sp-spring`, `#sp-steel` |
| `import { Spring, lerp, spring, steel } from "springs"` | only what's listed; a bare name brings everything the library defines under it (`.spring` or `#steel` picks just the class or colour) | as listed |

See [the spring library](../../examples/lib/springs.tmcpp) and [a graph that imports it](../../examples/springs-import.tmcpp) for a complete example.

### Internal names stay distinct

If the file (or another library) already uses a Desmos name, the library's copy gets another one (`lerp` becomes `lerp2`) and its uses are rewritten. An unprefixed import that conflicts with a name defined in the file is still a source-level error; use `as` to keep the names separate. Parameters, function arguments and `for` variables are never rewritten.

### Macros in libraries

Macros come in like components: `Glow(...)`, `g.Glow(...)` after `import ... as g`, or `import { Glow } from ...`. A macro's lines are written where it's used, and the library's own names inside it (`glowAlpha`, a private `_ring`) come along under their imported names. From graph gives back each use as written.

### Private names

A name starting with `_` (`_scale(x) = ...`, `component _Part(...)`, `class _faint`) works inside its library but can't be imported or reached with `ns._scale`: it's a helper, not part of what the library offers, and `tmcpp describe` leaves it out. Inside the file that imports, a `_name` is an error.

### Only what's used comes in

Components, macros, classes, colours, functions and constants are kept only if something uses them, with whatever they use in turn, so the metadata note lists just those. Functions and constants go in one collapsed, hidden folder named after the library, so a helper like `wave(x) = sin(x)` never draws.

### Libraries that import libraries

Libraries can import other libraries. Each library is emitted once however many files import it. A name brought in by two plain imports is an error where it's used: import one of them with `as`.

## Where libraries come from

| Import | Where it works |
| --- | --- |
| `"./parts/ui.tmcpp"`, relative to the importing file | CLI (`tmcpp`, `check`, `preview`), VS Code, and the MCP server, whose `push` sends the files along to the extension |
| `"springs"`, a name saved in the extension's Library panel | extension |
| `"gh:user/repo/path.tmcpp@ref"`, a file on GitHub (`@ref` is a branch, tag or commit; HEAD if left out) | extension, CLI, VS Code, MCP server |
| `"https://raw.githubusercontent.com/..."` or `"https://gist.githubusercontent.com/..."`, a raw file or gist (any `https://` URL outside the extension) | extension, CLI, VS Code, MCP server |
| `"https://github.com/user/repo/blob/main/path.tmcpp"`, a GitHub page link as copied from the browser | imports the raw file it shows, wherever raw GitHub URLs work |
| `"std/*"`: the built-in libraries | everywhere, offline; nothing to fetch |

Pin GitHub imports to a commit (`@3f2a9c1`) so a library can't change under your graph.

## Built-in libraries

The built-in libraries are the files in [`library/std`](../../library/std): `std/styles` (colours and classes such as `.axis`, `.handle`, `.primary`), `std/ui` (Button, Toggle, Stepper, ProgressBar…), `std/shapes` (Arrow, Box, Arc, RegularPolygon…), `std/easing` (easing curves), `std/3d` (camera, projection and rays), `std/color` (RGB gradients and lighting), `std/orbits` (elliptical two-body motion), and `std/mvc` (gradients, Jacobian–vector products, divergence and curl). They come with the compiler and change only with a TMC++ update; for a version that never changes, import the file from GitHub pinned to a commit instead.

### std/3d: 3D geometry in the 2D calculator

Use radians, with positive X pointing right, Y up and Z towards the viewer. `rotateX(p,a)`, `rotateY(p,a)` and `rotateZ(p,a)` each rotate one vertex stored as a three-number list. `ortho(p)` returns its drawable 2D point. For a mesh, store X, Y and Z in separate, equal-length lists.

```js
import { WireCube, projectOrtho } from "std/3d"
settings radians no-grid
turn = 0.5 [-pi : pi]
new WireCube((0,0), 3, turn, 0.36, 0) as cube
tip = projectOrtho(0, 0, 2, turn, 0.36, 0)
```

`projectOrtho(x,y,z,yaw,pitch,roll)` accepts scalars or coordinate columns. It rotates about the fixed Y axis, then X, then Z. `viewDepth(x,y,z,yaw,pitch)` gives the corresponding camera depth. `projectPerspective(x,y,z,yaw,pitch,roll,d)` places the eye at positive camera depth `d` and projects onto the plane at zero. Vertices at or beyond the eye have undefined projections. A segment that crosses the eye plane needs clipping by the caller. See [the wireframe cube](../../examples/wire-cube.tmcpp).

For a moving camera, subtract the target from each world coordinate first. Rotate with `viewX`, `viewY` and `viewDepth`, using the same angles as `projectOrtho`. Subtract the sideways and vertical offsets from the rotated X and Y, and pass `distance - viewDepth(...)` as the third argument to `projectCamera(right,up,forward,focal,near)`. It clips points whose forward distance is below the positive near plane. A focal length independent of distance lets you move the camera without changing the lens.

- `raySphereNear(dx,dy,dz,cx,cy,cz,radius)` returns the first nonnegative hit along a ray, or is undefined on a miss. From inside the sphere it returns the exit. `raySphereFar` returns the last forward hit.
- `rayPlane(dx,dy,dz,nx,ny,nz,offset)` intersects the plane `nx*x + ny*y + nz*z = offset`. Parallel rays and hits behind the ray origin are undefined.
- For both, ray origin is zero. Subtract the origin from the sphere center or plane point when working in another frame. The hit parameter multiplies the ray direction, so it is a distance if that direction has unit length. The helpers accept scalars or coordinate columns.
- `sphereRayDepth(rho,distance,radius)` gives the near distance of a unit ray aimed into a sphere's visible disk. Use `rho = sin(angleFromCenter) / (radius/distance)`, from 0 at the center to 1 at the rim. The eye must be outside the sphere.

### std/color: computed colour

`std/color` returns Desmos colors for `#(...)` style tails. `rgbClamped(r,g,b)` clamps channels to 0–255; `mixRgb(A,B,t)` blends two `[R,G,B]` triples, and `gradientRgb(R,G,B,t)` samples a palette from equally long, nonempty channel lists. Values of `t` outside 0–1 use the nearest end. Color blends are linear in RGB channel values. `shadeRgb(r,g,b,light)` scales and clamps channels. `diffuseLight(cosine,ambient,response)` takes the dot product of the unit surface normal and unit light direction. Use `response = 1` for Lambert lighting, or a positive value below 1 for a softer terminator.

### std/orbits: Kepler orbits

In `std/orbits`, `period(a,mu)` uses consistent units of length and time and `periodAU(a,mass)` uses AU, total solar masses and Julian years. Use `meanAt(epochAngle,elapsed,period)` and `eccentricAnomaly(mean,eccentricity)` to advance an ellipse in time. Angles are in radians and eccentricity must be in `[0,1)`. The solver wraps the result around zero. `radius(a,eccentricity,anomaly)` and `trueAnomaly(eccentricity,anomaly)` take eccentric anomaly as input. `orbitX/Y/Z(a,eccentricity,anomaly,inclination,node,periapsis)` return coordinate columns in a frame with +Z north. `position(...)` returns one three-number position. Pass `(orbitX, orbitZ, -orbitY)` to a Y-up camera. See all three libraries together in [the solar-system example](../../examples/solar-system.tmcpp).

### std/nested_lists: Nested Lists

In `std/nested_lists` create a list of lists with `new NestedList(size, initFuncion(x)) as name` and access elements with `name.list_1[1]`.


## The Library panel

In the extension, the **Library** button opens the panel:

- **Save as library** checks the editor's file as a library and stores it under the name you type, in the browser (`chrome.storage.local`, 10 MB). Nothing is saved if the check fails; the problems are listed as usual.
- **Import** adds `import "name"` to the top of the file. **Delete** asks once more before removing a library.
- A GitHub import isn't downloaded until you press **Fetch** next to it. The panel lists these after a compile. The copy is kept, so graphs compile offline; **Refetch** downloads it again.

The extension can only fetch from `raw.githubusercontent.com` and `gist.githubusercontent.com`, through its background worker. The CLI fetches `gh:` and `https://` imports itself; behind a proxy, run it with `NODE_USE_ENV_PROXY=1`.
