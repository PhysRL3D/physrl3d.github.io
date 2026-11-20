# PhysRL3D project page (anonymous review build)

Static page, no build step: `index.html` + `static/`. Anonymous while the paper is under review.

## SAS animation and generation workspace

- `film/#sas` and the homepage's `#sas-film` section show the 32-second SAS mechanism animation with its clip-time progress bar. Its media hash and illustration caveat are recorded in `static/film/sas-manifest.json`.
- `generate/` is an authenticated checkpoint-inference frontend: image input, seed, job polling, textured GLB inspection and download. Public GPU inference is **not enabled**; `generate/config.json` deliberately has no configured endpoint.
- Connect only an approved HTTPS service implementing `physrl3d-inference-v1`. The private key stays in tab memory. Never commit credentials, model weights, private GPU addresses or training paths to this repository.
- The service must verify its checkpoint before reporting ready, protect uploads/status/downloads with authentication, enforce job limits and expire temporary files. Changing reward weights is a post-training operation, not a feature of this inference frontend.
- Run `node --test tools/release.test.cjs tools/brand.test.cjs tools/inference.test.cjs` for website regression checks. Passing these tests does not validate a GPU model run.

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
- Source clips and photos: the 2026-11-13 prints (kangaroo and koala, 100 mm, Bambu Lab H2D). Re-encode with
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
