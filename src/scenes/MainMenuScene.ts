import * as ex from 'excalibur';
import { prepareGameAudioFromUserGesture } from '../audio/prepareGameAudio';
import { MainMenuScreen } from '../ui/MainMenuScreen';
import { SettingsScreen } from '../ui/SettingsScreen';

/**
 * First scene: main menu. Start runs audio prep (unlock + ZzFX bake) then enters gameplay.
 */
export class MainMenuScene extends ex.Scene {
  private menu!: MainMenuScreen;

  onInitialize(engine: ex.Engine): void {
    this.menu = this.createMainMenu(engine);
    this.add(this.menu);
  }

  /**
   * Must return a new instance whenever the previous menu was removed from the scene:
   * `remove`/`kill` runs `prekill` and tears down pointer subscriptions on the old actor.
   */
  private createMainMenu(engine: ex.Engine): MainMenuScreen {
    return new MainMenuScreen(
      engine,
      async () => {
        await prepareGameAudioFromUserGesture();
        engine.goToScene('gameplay');
      },
      () => this.openSettings(engine),
    );
  }

  private openSettings(engine: ex.Engine): void {
    this.remove(this.menu);
    const settings = new SettingsScreen(engine, () => {
      this.remove(settings);
      this.menu = this.createMainMenu(engine);
      this.add(this.menu);
    });
    this.add(settings);
  }
}
