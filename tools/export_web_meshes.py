#!/usr/bin/env python3
"""Export compact GLB assets from the verified mesh archive for the web viewer."""

from __future__ import annotations

import os
from pathlib import Path

import trimesh


ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "static" / "models"
SOURCE_ROOT = os.environ.get("PHYSRL3D_MESH_SOURCE")
if not SOURCE_ROOT:
    raise SystemExit(
        "Set PHYSRL3D_MESH_SOURCE to the directory containing the verified mesh assets."
    )
SOURCE = Path(SOURCE_ROOT)

CASES = {
    "koala-baseline": SOURCE / "old_v1/koala/koala_base_60mm.stl",
    "koala-physrl3d": SOURCE / "old_v1/koala/koala_ours_60mm.stl",
    "kangaroo-baseline": SOURCE / "kangaroo/kangaroo_base_60mm.stl",
    "kangaroo-physrl3d": SOURCE / "kangaroo/kangaroo_ours_60mm.stl",
}


def export_case(name: str, source: Path) -> None:
    mesh = trimesh.load(source, force="mesh", process=True)
    mesh = mesh.simplify_quadric_decimation(face_count=18000)
    mesh.remove_unreferenced_vertices()
    mesh.visual.vertex_colors = [222, 226, 232, 255]
    (MODELS / f"{name}.glb").write_bytes(trimesh.exchange.gltf.export_glb(mesh))


def main() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)
    for name, source in CASES.items():
        export_case(name, source)


if __name__ == "__main__":
    main()
