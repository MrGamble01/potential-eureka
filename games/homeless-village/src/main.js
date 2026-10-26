import { CampScene } from './scenes/CampScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17191e',
  banner: false,
  audio: { noAudio: true },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  input: { activePointers: 2 },
  scene: [CampScene]
});

window.HVGame = game;
