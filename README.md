# PhysRL3D project page (anonymous review build)

Static page, no build step: `index.html` + `static/`. Anonymous while the paper is under review.

This revision adds the anonymized method overview, physics-simulation evidence, 360-degree mesh turntables, and interactive mesh viewers, following the narrative structure of an academic project page: abstract, method, simulation evidence, and real-world evidence.

## Preview locally
Open `index.html` in a browser, or serve the folder (`npx serve .`) to get the same MIME handling as GitHub Pages.

## Media
- `static/videos/*.mp4` (H.264, 25 fps, no audio, faststart) and `*.webm` (VP9) of each clip, with a poster frame in
  `static/images/*_poster.jpg`. The review build crops out the office background to focus on the printed objects, and strips media metadata.
- `static/images/method_pipeline.png`: the anonymous pipeline figure rendered from the paper source.
- `static/models/*.glb`: compact, 18k-face display meshes for the Koala and Kangaroo visualizers. They are derived from the corresponding verified mesh outputs; the original print meshes are not published.
- `static/images/{kangaroo,koala}_{trellis2,sas}_{supports,removed}.jpg`: 1.75:1 crops of the print photos, colour-balanced to the
  same white level as the paper figures.
- Source clips and photos: the 2026-11-13 prints (kangaroo and koala, 60 mm, Bambu Lab H2D). Re-encode with
  `tools/encode_media.sh "<folder with the original clips>"`.

| Clip | Shows |
|---|---|
| `kangaroo_pair_halfspeed` | both kangaroos after support removal; TRELLIS.2 (left) falls, PhysRL3D-SAS (right) stands; half speed |
| `kangaroo_trellis2_falls_a` / `_b` | the TRELLIS.2 kangaroo released by hand, falling (real time) |
| `koala_pair_front` | both koalas standing, front view: TRELLIS.2 left, PhysRL3D-SAS right |
| `koala_pair_back` | the same koalas from behind (iPhone HDR clip tone-mapped to SDR): PhysRL3D-SAS left, TRELLIS.2 right |

To recreate the display meshes from a verified local archive, set `PHYSRL3D_MESH_SOURCE` and run `tools/export_web_meshes.py`. The script intentionally does not embed a local archive path.

## Before making anything public
- Do not publish under a personal GitHub account whose profile identifies an author. Use an anonymous organization or account, with no personal domain/CNAME.
- The page lists no authors. Configure the repository's commits with the anonymous review author before the first push.
- GitHub Pages serves a private repository only on a paid plan; on a free plan the repository must be public. A public review repository must not expose author identity through its owner, members, commits, or links.
- Add the author list, affiliations, paper/arXiv/code links and the final BibTeX when the paper is public.
