#!/bin/zsh
# Encode the 2026-11-13 print clips and photos for the project page (H.264 + VP9, no audio, posters).
# usage: tools/encode_media.sh SRC_DIR   (SRC_DIR = folder with the original clips C0137-C0141.MP4 and IMG_5794.MOV); run from
#   the page root.
set -e
SRC="$1"; V=static/videos; I=static/images; mkdir -p $V $I
X264=(-c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -profile:v high -movflags +faststart -an -map_metadata -1
      -colorspace bt709 -color_primaries bt709 -color_trc bt709)
VP9=(-c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -an -map_metadata -1)
enc() { # name input vf [extra input opts...]
  local name=$1 in=$2 vf=$3
  ffmpeg -hide_banner -loglevel error -y -i "$in" -vf "$vf" -r 25 "${X264[@]}" $V/$name.mp4
  ffmpeg -hide_banner -loglevel error -y -i "$in" -vf "$vf" -r 25 "${VP9[@]}" $V/$name.webm
  ffmpeg -hide_banner -loglevel error -y -sseof -0.2 -i "$in" -vf "$vf" -frames:v 1 -q:v 3 $I/${name}_poster.jpg
}
L='scale=1280:720:flags=lanczos'; P='scale=720:1280:flags=lanczos'
# kangaroo pair, TRELLIS.2 (left) released and falls, PhysRL3D-SAS (right) stands; half speed
enc kangaroo_pair_halfspeed "$SRC/C0140.MP4" "setpts=2.0*PTS,$L"
# TRELLIS.2 kangaroo released by hand, falls (two takes)
enc kangaroo_trellis2_falls_a "$SRC/C0138.MP4" "$L"
enc kangaroo_trellis2_falls_b "$SRC/C0137.MP4" "$P"
# both koalas after support removal, standing; front (Sony) and back (iPhone HLG -> SDR)
enc koala_pair_front "$SRC/C0141.MP4" "$P"
enc koala_pair_back "$SRC/IMG_5794.MOV" "zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,$P"
ls -la $V $I
