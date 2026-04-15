import * as ex from 'excalibur';
import { prepareGameAudioFromUserGesture } from '../audio/prepareGameAudio';
import { startTrackerPlaylist } from '../audio/roomTrackerMusic';
import { ZzfxmMusicPlayer } from '../audio/ZzfxmMusicPlayer';
import { ExpertScreen } from '../ui/ExpertScreen';
import { MainMenuScreen } from '../ui/MainMenuScreen';
import { SettingsScreen } from '../ui/SettingsScreen';
import { GameplayScene } from './GameplayScene';

/**
 * First scene: main menu. Start runs audio prep (unlock + ZzFX bake) then enters gameplay.
 */
export class MainMenuScene extends ex.Scene {
  private menu!: MainMenuScreen;

  onInitialize(engine: ex.Engine): void {
    this.menu = this.createMainMenu(engine);
    this.add(this.menu);
  }

  onActivate(ctx: ex.SceneActivationContext): void {
    this.menu.armPointerSuppressionAfterShow();
    // Excalibur reuses the same GameplayScene instance on `goToScene('gameplay')` unless we replace
    // it here, so quitting would leave the old run simulating behind the menu and stacking GameEvents.
    if (ctx.previousScene instanceof GameplayScene) {
      ZzfxmMusicPlayer.stop();
      const eng = ctx.engine;
      eng.removeScene('gameplay');
      eng.addScene('gameplay', new GameplayScene());
      startTrackerPlaylist();
    }
  }

  onDeactivate(_ctx: ex.SceneActivationContext): void {
    this.menu.resetPointerStateForSceneLeave();
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
      () => this.openExpert(engine),
    );
  }

  private openSettings(engine: ex.Engine): void {
    this.remove(this.menu);
    const settings = new SettingsScreen(engine, () => {
      this.remove(settings);
      this.menu = this.createMainMenu(engine);
      this.add(this.menu);
      this.menu.armPointerSuppressionAfterShow();
    });
    this.add(settings);
  }

  private openExpert(engine: ex.Engine): void {
    this.remove(this.menu);
    const expert = new ExpertScreen(engine, () => {
      this.remove(expert);
      this.menu = this.createMainMenu(engine);
      this.add(this.menu);
      this.menu.armPointerSuppressionAfterShow();
    });
    this.add(expert);
  }
}
