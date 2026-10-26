// Procedural camp art. Generated once into Phaser textures so the
// page stays static — no image pipeline and no build step.

function tex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ add: false });
  draw(g, w, h);
  g.generateTexture(key, w, h);
  g.destroy();
}

function person(g, coat, skin, hair, pants) {
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(32, 90, 34, 12);
  g.fillStyle(pants);
  g.fillRoundedRect(22, 62, 8, 22, 2);
  g.fillRoundedRect(34, 62, 8, 22, 2);
  g.fillStyle(0x241e1a);
  g.fillRoundedRect(20, 80, 12, 6, 2);
  g.fillRoundedRect(33, 80, 12, 6, 2);
  g.fillStyle(coat);
  g.fillRoundedRect(16, 40, 32, 28, 7);
  g.fillStyle(0x000000, 0.14);
  g.fillRect(30, 42, 4, 24);
  g.fillStyle(coat);
  g.fillRoundedRect(12, 44, 8, 18, 3);
  g.fillRoundedRect(44, 44, 8, 18, 3);
  g.fillStyle(skin);
  g.fillCircle(16, 60, 3.5);
  g.fillCircle(48, 60, 3.5);
  g.fillStyle(skin);
  g.fillCircle(32, 30, 11);
  g.fillStyle(hair);
  g.fillEllipse(32, 22, 22, 12);
  g.fillRect(22, 20, 20, 6);
  g.fillStyle(0x1a120e, 0.85);
  g.fillCircle(28, 31, 1.3);
  g.fillCircle(36, 31, 1.3);
}

export function paintTextures(scene) {
  tex(scene, 'ground', 256, 256, (g) => {
    g.fillStyle(0x3c3832);
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = (i * 47) % 256;
      const y = (i * 83) % 256;
      g.fillStyle(i % 3 === 0 ? 0x322e29 : 0x4a453c, 0.45);
      g.fillRect(x, y, 2 + (i % 4), 2);
    }
    g.lineStyle(2, 0x2e2b27, 0.35);
    g.lineBetween(0, 128, 256, 128);
  });

  tex(scene, 'asphalt', 128, 128, (g) => {
    g.fillStyle(0x2b2f36);
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x24282e, 0.6);
      g.fillRect((i * 31) % 128, (i * 17) % 128, 3, 2);
    }
  });

  tex(scene, 'shadow', 64, 24, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(32, 12, 56, 16);
  });

  tex(scene, 'ring', 72, 28, (g) => {
    g.lineStyle(2, 0xe7e4dc, 0.55);
    g.strokeEllipse(36, 14, 60, 18);
  });

  tex(scene, 'spark', 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 6);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(8, 8, 3);
  });

  tex(scene, 'streak', 6, 18, (g) => {
    g.fillStyle(0xffffff, 0.85);
    g.fillRoundedRect(2, 0, 2, 18, 1);
  });

  tex(scene, 'player', 64, 96, (g) => person(g, 0x8c4a32, 0xc48a62, 0x2a211c, 0x3d4654));
  tex(scene, 'npc-scrap', 64, 96, (g) => person(g, 0x6e6248, 0xb5815a, 0x1c1a18, 0x3a3a40));
  tex(scene, 'npc-build', 64, 96, (g) => person(g, 0x4d6a86, 0xc49a74, 0x3a2a22, 0x2e3644));
  tex(scene, 'npc-cook', 64, 96, (g) => person(g, 0x8d5a3c, 0xd0a07a, 0x4a3024, 0x3e342c));
  tex(scene, 'npc-look', 64, 96, (g) => person(g, 0x3e4c44, 0xc4966c, 0x201814, 0x2c3330));
  tex(scene, 'npc-marisol', 64, 96, (g) => person(g, 0xd97736, 0xc48460, 0x1a120e, 0x3a2e28));
  tex(scene, 'npc-ray', 64, 96, (g) => person(g, 0x6b8e78, 0xd2b49a, 0x6a645c, 0x3a403c));
  tex(scene, 'npc-dee', 64, 96, (g) => person(g, 0x5c88b8, 0xc48b6a, 0x241810, 0x2c3340));
  tex(scene, 'npc-june', 64, 96, (g) => person(g, 0xd8d4cc, 0xc48a62, 0x2a2420, 0x3a4048));
  tex(scene, 'npc-rio', 64, 96, (g) => person(g, 0x2f4a62, 0xb88862, 0x1a140f, 0x2a3038));
  tex(scene, 'npc-dena', 64, 96, (g) => person(g, 0x4e5560, 0xc99570, 0x2c241c, 0x2a2e36));
  tex(scene, 'npc-new', 64, 96, (g) => person(g, 0x6a5a68, 0xc48a62, 0x231910, 0x343038));

  tex(scene, 'dog', 72, 48, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(36, 42, 48, 10);
    g.fillStyle(0xc4a574);
    g.fillEllipse(34, 28, 40, 18);
    g.fillCircle(54, 20, 9);
    g.fillStyle(0x8a623c);
    g.fillEllipse(58, 12, 8, 10);
    g.fillStyle(0x3a2a22);
    g.fillEllipse(48, 12, 7, 8);
    g.fillStyle(0x2a211c);
    g.fillCircle(57, 19, 1.2);
    g.fillStyle(0xc4a574);
    g.fillRoundedRect(18, 30, 5, 10, 2);
    g.fillRoundedRect(28, 32, 5, 10, 2);
    g.fillRoundedRect(40, 32, 5, 9, 2);
    g.fillCircle(14, 26, 4);
  });

  tex(scene, 'barrel', 72, 80, (g) => {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(36, 72, 50, 14);
    g.fillStyle(0x5a4030);
    g.fillRoundedRect(16, 28, 40, 40, 6);
    g.fillStyle(0x3e2c22);
    g.fillEllipse(36, 28, 40, 14);
    g.fillStyle(0x6b4c38);
    g.fillEllipse(36, 26, 34, 10);
    g.fillStyle(0x2a221c);
    g.fillRect(16, 38, 40, 4);
    g.fillRect(16, 54, 40, 4);
    g.fillStyle(0xc9844a);
    g.fillRect(34, 40, 4, 12);
  });

  [0, 1, 2, 3].forEach((i) => {
    tex(scene, 'flame' + i, 64, 64, (g) => {
      const lean = (i - 1.5) * 4;
      g.fillStyle(0xff9a3c, 0.95);
      g.fillTriangle(32 + lean, 6 + (i % 2) * 6, 16, 50, 48, 46);
      g.fillStyle(0xffc56a, 0.9);
      g.fillTriangle(32 + lean * 0.4, 16, 24, 48, 40, 46);
      g.fillStyle(0xfff6df, 0.95);
      g.fillEllipse(32, 36, 10, 16);
    });
  });

  tex(scene, 'dumpster', 96, 72, (g) => {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(48, 64, 80, 14);
    g.fillStyle(0x2f6a48);
    g.fillRoundedRect(10, 22, 76, 38, 4);
    g.fillStyle(0x3d8660);
    g.fillRect(14, 26, 68, 8);
    g.lineStyle(2, 0x1d4030, 0.8);
    g.strokeRect(18, 36, 26, 16);
    g.strokeRect(50, 36, 26, 16);
    g.fillStyle(0x243028);
    g.fillRect(8, 18, 8, 14);
    g.fillRect(80, 18, 8, 14);
  });

  tex(scene, 'bench', 100, 64, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(50, 56, 84, 14);
    g.fillStyle(0x6a5038);
    g.fillRect(18, 46, 6, 12);
    g.fillRect(76, 46, 6, 12);
    g.fillStyle(0x8b6844);
    g.fillRoundedRect(8, 28, 84, 16, 3);
    g.fillStyle(0xa67c52);
    g.fillRect(12, 30, 76, 4);
    g.fillStyle(0x4a4038);
    g.fillRect(40, 36, 18, 6);
  });

  tex(scene, 'pallet', 100, 64, (g) => {
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(50, 54, 80, 12);
    g.fillStyle(0x7a6248);
    for (let i = 0; i < 5; i++) g.fillRect(14 + i * 15, 24, 10, 28);
    g.fillStyle(0x5c4634);
    g.fillRect(12, 30, 76, 5);
    g.fillRect(12, 44, 76, 5);
  });

  tex(scene, 'tent', 120, 90, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(60, 80, 100, 16);
    g.fillStyle(0x8c5a3a);
    g.fillTriangle(60, 14, 10, 74, 110, 74);
    g.fillStyle(0xa56b46);
    g.fillTriangle(60, 18, 60, 74, 104, 74);
    g.fillStyle(0x2a241e);
    g.fillTriangle(60, 40, 46, 74, 74, 74);
    g.lineStyle(2, 0x3a2e26, 0.7);
    g.lineBetween(60, 16, 60, 74);
  });

  tex(scene, 'soup', 110, 80, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(55, 70, 90, 14);
    g.fillStyle(0x5c5348);
    g.fillRoundedRect(16, 36, 78, 30, 4);
    g.fillStyle(0xc46a3a);
    g.fillEllipse(54, 34, 36, 16);
    g.fillStyle(0xe8d2a4);
    g.fillEllipse(54, 32, 22, 8);
    g.fillStyle(0x8a9094);
    g.fillRect(78, 18, 6, 28);
    g.fillCircle(81, 16, 7);
  });

  tex(scene, 'garden', 110, 70, (g) => {
    g.fillStyle(0x3d4a32);
    g.fillRoundedRect(8, 28, 94, 32, 6);
    g.fillStyle(0x2e3a26);
    g.fillRect(14, 34, 82, 6);
    g.fillStyle(0x6a9a48);
    g.fillCircle(28, 30, 8);
    g.fillCircle(48, 24, 10);
    g.fillCircle(70, 30, 8);
    g.fillCircle(88, 26, 7);
    g.fillStyle(0xc45a48);
    g.fillCircle(48, 22, 3);
    g.fillCircle(70, 28, 2);
  });

  tex(scene, 'clinic', 110, 86, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(55, 76, 90, 14);
    g.fillStyle(0xd8d2c6);
    g.fillRoundedRect(18, 28, 74, 44, 4);
    g.fillStyle(0xb7b1a6);
    g.fillRect(18, 28, 74, 10);
    g.fillStyle(0xc45050);
    g.fillRect(50, 40, 10, 22);
    g.fillRect(42, 48, 26, 8);
  });

  tex(scene, 'gate', 90, 80, (g) => {
    g.fillStyle(0x8a9298);
    g.fillRect(14, 16, 8, 56);
    g.fillRect(68, 16, 8, 56);
    g.lineStyle(4, 0x6a7278, 1);
    g.lineBetween(18, 24, 72, 24);
    g.lineBetween(18, 40, 72, 40);
    g.lineBetween(18, 56, 72, 56);
    g.lineStyle(3, 0xc9844a, 0.9);
    g.lineBetween(18, 16, 72, 16);
  });

  tex(scene, 'board', 64, 72, (g) => {
    g.fillStyle(0x3a322c);
    g.fillRect(30, 40, 6, 28);
    g.fillStyle(0x6a5438);
    g.fillRoundedRect(8, 8, 48, 40, 3);
    g.fillStyle(0xe7e4dc);
    g.fillRect(14, 16, 28, 3);
    g.fillRect(14, 24, 36, 3);
    g.fillRect(14, 32, 22, 3);
  });

  tex(scene, 'wall', 80, 100, (g) => {
    g.fillStyle(0x5a5e66);
    g.fillRect(8, 4, 64, 92);
    g.fillStyle(0x4a4e56);
    g.fillRect(8, 4, 10, 92);
    g.fillStyle(0xe7e4dc, 0.75);
    g.fillCircle(28, 30, 2);
    g.fillCircle(40, 26, 2);
    g.fillCircle(34, 38, 2);
    g.fillRect(24, 48, 28, 3);
    g.fillRect(22, 56, 18, 3);
    g.fillStyle(0xd8c4a4, 0.5);
    g.fillRect(26, 66, 24, 8);
  });

  tex(scene, 'brush', 90, 70, (g) => {
    g.fillStyle(0x3d4a32, 0.9);
    g.fillEllipse(30, 40, 36, 22);
    g.fillEllipse(58, 46, 40, 24);
    g.fillStyle(0x6a5030);
    g.fillRect(20, 28, 6, 22);
    g.fillRect(48, 24, 5, 26);
    g.fillRect(64, 30, 4, 18);
  });

  tex(scene, 'crate', 56, 48, (g) => {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(28, 42, 40, 10);
    g.fillStyle(0x7a5a3c);
    g.fillRoundedRect(8, 14, 40, 26, 3);
    g.lineStyle(2, 0x4e3828, 0.8);
    g.strokeRect(12, 18, 32, 18);
    g.lineBetween(12, 18, 44, 36);
  });

  tex(scene, 'radio', 48, 40, (g) => {
    g.fillStyle(0x2c3138);
    g.fillRoundedRect(4, 10, 40, 24, 4);
    g.fillStyle(0x1a1e22);
    g.fillCircle(18, 22, 7);
    g.fillStyle(0xc9844a);
    g.fillCircle(34, 18, 3);
    g.fillRect(30, 4, 3, 10);
  });

  tex(scene, 'guitar', 40, 70, (g) => {
    g.fillStyle(0x8a5a32);
    g.fillEllipse(16, 44, 22, 28);
    g.fillCircle(28, 40, 10);
    g.fillStyle(0x3a2a22);
    g.fillCircle(20, 46, 4);
    g.fillStyle(0xd8c4a0);
    g.fillRect(30, 8, 4, 36);
  });

  tex(scene, 'cart', 80, 56, (g) => {
    g.fillStyle(0x5c646c);
    g.fillRoundedRect(10, 16, 58, 24, 3);
    g.fillStyle(0x2a2e32);
    g.fillCircle(24, 44, 7);
    g.fillCircle(56, 44, 7);
    g.fillStyle(0x8a9298);
    g.fillRect(64, 20, 10, 4);
  });

  tex(scene, 'coats', 70, 74, (g) => {
    g.fillStyle(0x4a4038);
    g.fillRect(8, 16, 54, 4);
    g.fillRect(14, 16, 4, 48);
    g.fillRect(52, 16, 4, 48);
    g.fillStyle(0x6a7890);
    g.fillRoundedRect(18, 22, 16, 28, 4);
    g.fillStyle(0x8a5040);
    g.fillRoundedRect(36, 22, 14, 26, 4);
  });

  tex(scene, 'awning', 120, 50, (g) => {
    g.fillStyle(0x3a4248);
    g.fillRect(8, 28, 4, 18);
    g.fillRect(108, 28, 4, 18);
    g.fillStyle(0xc46a3a);
    g.fillRoundedRect(4, 10, 112, 18, 3);
    g.fillStyle(0x8c4630);
    for (let i = 0; i < 6; i++) g.fillRect(8 + i * 18, 10, 8, 18);
  });

  tex(scene, 'rainbarrel', 48, 64, (g) => {
    g.fillStyle(0x3a4a58);
    g.fillRoundedRect(8, 12, 32, 44, 8);
    g.fillStyle(0x6aa0c0, 0.8);
    g.fillEllipse(24, 16, 24, 8);
    g.fillStyle(0x2a3844);
    g.fillRect(8, 28, 32, 3);
    g.fillRect(8, 40, 32, 3);
  });

  tex(scene, 'pillar', 78, 460, (g, w, h) => {
    g.fillStyle(0x000000, 0.2);
    g.fillRect(8, 8, w - 10, h - 8);
    g.fillStyle(0x6a7078);
    g.fillRect(0, 0, w - 16, h);
    g.fillStyle(0x80868e);
    g.fillRect(6, 0, 14, h);
    g.fillStyle(0x525860);
    g.fillRect(w - 28, 0, 12, h);
    for (let y = 40; y < h; y += 78) {
      g.fillStyle(0x5a6068, 0.7);
      g.fillRect(0, y, w - 16, 8);
    }
  });
}

export function ensureAnims(scene) {
  if (scene.anims.exists('flame')) return;
  scene.anims.create({
    key: 'flame',
    frames: [0, 1, 2, 3].map((i) => ({ key: 'flame' + i })),
    frameRate: 9,
    repeat: -1
  });
}
