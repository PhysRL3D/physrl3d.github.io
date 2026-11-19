/* Figure 10 / fig:simall, 2026-11-17 archived source. Angles are paper-reported, not rerun measurements.
   Fill simulation only after matching the original input/mesh/checkpoint and source timing.
   No remote media requests or invented filenames are used for missing clips. */
(function (root) {
  const cases = [
  {
    "id": "hydrant",
    "name": "Fire hydrant",
    "order": 1,
    "category": "object",
    "tags": [
      "消防栓",
      "hydrant"
    ],
    "tilt": {
      "base": 88,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/hydrant_base.jpg",
      "ours": "assets/figs/sim/appendix/hydrant_sas.jpg"
    },
    "simulation": {
      "verified": true,
      "verificationScope": "Transferred source clips and sidecars matched; SHA256 agrees with d61; 96 frames / 24fps / 4s decoded locally. Not a new physics rerun.",
      "durationS": 9.958333333333334,
      "timeline": {"fps":24,"mediaDurationS":4,"segments":[{"mediaStartS":0,"mediaEndS":3,"simStartS":0,"rate":1},{"mediaStartS":3,"mediaEndS":4,"simStartS":9.958333333333334,"rate":0}]},
      "base": {"src":"assets/pilot_hydrant/trellis2_color.mp4","poster":"assets/pilot_hydrant/trellis2_start.jpg","releaseOffsetS":0,"simSecondsPerMediaSecond":1,"sha256":"9df1ad767cc4411c488c54c3eaf669a6866c4c40b72fb44aecfeb941ddd38dd6"},
      "ours": {"src":"assets/pilot_hydrant/tds_color.mp4","poster":"assets/pilot_hydrant/sas_start.jpg","releaseOffsetS":0,"simSecondsPerMediaSecond":1,"sha256":"4d785a4bc79c5486c4241432ce0b2d0362815b34aadb1447557072749841aee8"}
    },
    "input": "assets/pilot_hydrant/input.png",
    "provenance": {"uid":"ffba9ea51d8e0b3a8bc14fd28c9b4f9cce801e952d4636a3d291290043c9022e","baseTag":"base_g2","sasTag":"tdsd_s43_sd_e80","initialCondition":"resting on the floor; no drop","jsonBase":"assets/pilot_hydrant/trellis2_color.json","jsonOurs":"assets/pilot_hydrant/tds_color.json"},
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "dog",
    "name": "Dog",
    "order": 2,
    "category": "animal",
    "tags": [
      "狗"
    ],
    "tilt": {
      "base": 121,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/dog_base.jpg",
      "ours": "assets/figs/sim/appendix/dog_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "woman",
    "name": "Standing woman",
    "order": 3,
    "category": "character",
    "tags": [
      "女人",
      "人物"
    ],
    "tilt": {
      "base": 90,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/woman_base.jpg",
      "ours": "assets/figs/sim/appendix/woman_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "femsword",
    "name": "Female figure with sword",
    "order": 4,
    "category": "character",
    "tags": [
      "剑",
      "女性"
    ],
    "tilt": {
      "base": 86,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/femsword_base.jpg",
      "ours": "assets/figs/sim/appendix/femsword_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "staff",
    "name": "Warrior with staff",
    "order": 5,
    "category": "character",
    "tags": [
      "战士",
      "法杖"
    ],
    "tilt": {
      "base": 90,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/staff_base.jpg",
      "ours": "assets/figs/sim/appendix/staff_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "lowpoly",
    "name": "Low-poly figure",
    "order": 6,
    "category": "character",
    "tags": [
      "低多边形",
      "人物"
    ],
    "tilt": {
      "base": 109,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/lowpoly_base.jpg",
      "ours": "assets/figs/sim/appendix/lowpoly_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "humanoid",
    "name": "Humanoid robot",
    "order": 7,
    "category": "character",
    "tags": [
      "机器人"
    ],
    "tilt": {
      "base": 87,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/humanoid_base.jpg",
      "ours": "assets/figs/sim/appendix/humanoid_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "boxy",
    "name": "Boxy robot",
    "order": 8,
    "category": "character",
    "tags": [
      "机器人",
      "方形"
    ],
    "tilt": {
      "base": 104,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/boxy_base.jpg",
      "ours": "assets/figs/sim/appendix/boxy_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "hair",
    "name": "Hair and head",
    "order": 9,
    "category": "character",
    "tags": [
      "头发",
      "头部"
    ],
    "tilt": {
      "base": 100,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/hair_base.jpg",
      "ours": "assets/figs/sim/appendix/hair_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "headbust",
    "name": "Head bust",
    "order": 10,
    "category": "character",
    "tags": [
      "半身像",
      "头部"
    ],
    "tilt": {
      "base": 18,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/headbust_base.jpg",
      "ours": "assets/figs/sim/appendix/headbust_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "frog",
    "name": "Frog-like figure",
    "order": 11,
    "category": "animal",
    "tags": [
      "青蛙"
    ],
    "tilt": {
      "base": 92,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/frog_base.jpg",
      "ours": "assets/figs/sim/appendix/frog_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "camel",
    "name": "Camel",
    "order": 12,
    "category": "animal",
    "tags": [
      "骆驼"
    ],
    "tilt": {
      "base": 81,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/camel_base.jpg",
      "ours": "assets/figs/sim/appendix/camel_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "cat",
    "name": "Armoured cat",
    "order": 13,
    "category": "animal",
    "tags": [
      "猫"
    ],
    "tilt": {
      "base": 80,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/cat_base.jpg",
      "ours": "assets/figs/sim/appendix/cat_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "skeleton",
    "name": "Quadruped skeleton",
    "order": 14,
    "category": "animal",
    "tags": [
      "骨架"
    ],
    "tilt": {
      "base": 87,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/skeleton_base.jpg",
      "ours": "assets/figs/sim/appendix/skeleton_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "spider",
    "name": "Spider",
    "order": 15,
    "category": "animal",
    "tags": [
      "蜘蛛"
    ],
    "tilt": {
      "base": 56,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/spider_base.jpg",
      "ours": "assets/figs/sim/appendix/spider_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "cypress",
    "name": "Cypress tree",
    "order": 16,
    "category": "vegetation",
    "tags": [
      "柏树",
      "树"
    ],
    "tilt": {
      "base": 86,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/cypress_base.jpg",
      "ours": "assets/figs/sim/appendix/cypress_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "baretree",
    "name": "Bare tree",
    "order": 17,
    "category": "vegetation",
    "tags": [
      "枯树",
      "树"
    ],
    "tilt": {
      "base": 84,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/baretree_base.jpg",
      "ours": "assets/figs/sim/appendix/baretree_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "monitor",
    "name": "Computer monitor",
    "order": 18,
    "category": "object",
    "tags": [
      "显示器",
      "电脑"
    ],
    "tilt": {
      "base": 92,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/monitor_base.jpg",
      "ours": "assets/figs/sim/appendix/monitor_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "belljar",
    "name": "Bell-jar machine",
    "order": 19,
    "category": "object",
    "tags": [
      "机器",
      "钟罩"
    ],
    "tilt": {
      "base": 94,
      "ours": 0
    },
    "stills": {
      "base": "assets/figs/sim/appendix/belljar_base.jpg",
      "ours": "assets/figs/sim/appendix/belljar_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  },
  {
    "id": "scifi",
    "name": "Sci-fi vehicle",
    "order": 20,
    "category": "object",
    "tags": [
      "科幻",
      "车辆"
    ],
    "tilt": {
      "base": 121,
      "ours": 11
    },
    "stills": {
      "base": "assets/figs/sim/appendix/scifi_base.jpg",
      "ours": "assets/figs/sim/appendix/scifi_sas.jpg"
    },
    "simulation": {
      "verified": false,
      "durationS": null,
      "base": null,
      "ours": null
    },
    "input": null,
    "turntable": null,
    "realPrint": null
  }
];
  if (typeof module === 'object' && module.exports) module.exports = cases;
  else root.PHYSRL3D_CASES = cases;
})(typeof window !== 'undefined' ? window : globalThis);
