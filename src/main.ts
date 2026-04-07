import * as ex from 'excalibur';
import { GameplayScene } from './scenes/GameplayScene';
import { GAME } from './constants';

const game = new ex.Engine({
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: ex.Color.Black,
  antialiasing: true,
  displayMode: ex.DisplayMode.FitScreen,
});

const gameplay = new GameplayScene();
game.addScene('gameplay', gameplay);

game.start().then(() => {
  game.goToScene('gameplay');
});
