#!/usr/bin/env python3
"""Render compact, anonymous turntables directly from the verified print meshes."""

from __future__ import annotations

import shutil
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np
import trimesh


ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "static" / "videos"
IMAGE_DIR = ROOT / "static" / "images"
SOURCE_ROOT = os.environ.get("PHYSRL3D_MESH_SOURCE")
if not SOURCE_ROOT:
    raise SystemExit(
        "Set PHYSRL3D_MESH_SOURCE to the directory containing the verified mesh assets."
    )
SOURCE = Path(SOURCE_ROOT)

CASES = {
    "koala-base-turntable": (SOURCE / "old_v1/koala/koala_base_60mm.stl", "#c65b55"),
    "koala-physrl3d-turntable": (SOURCE / "old_v1/koala/koala_ours_60mm.stl", "#2878b5"),
    "kangaroo-base-turntable": (SOURCE / "kangaroo/kangaroo_base_60mm.stl", "#c65b55"),
    "kangaroo-physrl3d-turntable": (SOURCE / "kangaroo/kangaroo_ours_60mm.stl", "#2878b5"),
}

FPS = 12
FRAMES = 24
SIZE = 480
ELEVATION = 17


def face_colours(mesh: trimesh.Trimesh, colour: str) -> np.ndarray:
    base = np.array([int(colour[i : i + 2], 16) for i in (1, 3, 5)], dtype=float) / 255.0
    light = np.array([0.55, -0.70, 0.80])
    light /= np.linalg.norm(light)
    diffuse = 0.35 + 0.65 * np.maximum(0.0, mesh.face_normals @ light)
    return np.clip(base[None, :] * (0.50 + 0.50 * diffuse[:, None]), 0.0, 1.0)


def render_case(name: str, mesh_path: Path, colour: str) -> None:
    mesh = trimesh.load(mesh_path, force="mesh", process=True)
    mesh = mesh.simplify_quadric_decimation(face_count=18000)
    triangles = mesh.vertices[mesh.faces]
    center = mesh.bounds.mean(axis=0)
    radius = float(max(mesh.extents) * 0.58)
    colours = face_colours(mesh, colour)

    frame_dir = ROOT / ".turntable_frames" / name
    if frame_dir.exists():
        shutil.rmtree(frame_dir)
    frame_dir.mkdir(parents=True)

    fig = plt.figure(figsize=(SIZE / 120, SIZE / 120), dpi=120)
    fig.patch.set_facecolor("#f7f8fb")
    axis = fig.add_subplot(projection="3d")
    axis.add_collection3d(
        Poly3DCollection(triangles, facecolors=colours, edgecolors="none", linewidths=0, antialiased=True)
    )
    axis.set_xlim(center[0] - radius, center[0] + radius)
    axis.set_ylim(center[1] - radius, center[1] + radius)
    axis.set_zlim(center[2] - radius, center[2] + radius)
    axis.set_box_aspect((1, 1, 1))
    axis.set_axis_off()
    axis.set_facecolor("#f7f8fb")

    for frame in range(FRAMES):
        axis.view_init(elev=ELEVATION, azim=frame * 360 / FRAMES)
        fig.savefig(frame_dir / f"{frame:03d}.png", bbox_inches="tight", pad_inches=0.02, facecolor=fig.get_facecolor())
    plt.close(fig)

    # A poster is an actual rendered frame, rather than a synthetic thumbnail.
    shutil.copy2(frame_dir / "000.png", IMAGE_DIR / f"{name}.png")
    ffmpeg = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
        "-i", str(frame_dir / "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", str(VIDEO_DIR / f"{name}.mp4"),
    ]
    import subprocess
    subprocess.run(ffmpeg, check=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(FPS),
         "-i", str(frame_dir / "%03d.png"), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
         str(VIDEO_DIR / f"{name}.webm")],
        check=True,
    )
    shutil.rmtree(frame_dir)


def main() -> None:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for name, (mesh_path, colour) in CASES.items():
        render_case(name, mesh_path, colour)


if __name__ == "__main__":
    main()
