import * as ex from 'excalibur';
import { GameplayScene } from './scenes/GameplayScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GAME } from './constants';
import { initExpertSettings } from './settings/ExpertSettings';
import { initGameSettings } from './settings/GameSettings';

initGameSettings();
initExpertSettings();

const game = new ex.Engine({
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: ex.Color.Black,
  antialiasing: true,
  displayMode: ex.DisplayMode.FitScreen,
});

game.addScene('menu', new MainMenuScene());
game.addScene('gameplay', new GameplayScene());

game.start().then(() => {
  game.goToScene('menu');
});
