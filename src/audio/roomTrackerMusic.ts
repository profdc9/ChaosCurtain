import { AudioManager } from './AudioManager';
import DebugConfig from '../constants/DebugConfig';
import { ZzfxmMusicPlayer } from './ZzfxmMusicPlayer';
import { GameEvents } from '../utils/GameEvents';

import drozerixAiRenaissance from '../../modtracker/zzfxm-converted/drozerix_-_ai_renaissance.js';
import drozerixStardustJam from '../../modtracker/zzfxm-converted/drozerix_-_stardust_jam.js';
import fxPoly1 from '../../modtracker/zzfxm-converted/fx-poly1.js';
import hit from '../../modtracker/zzfxm-converted/hit.js';
import k0wRsnd from '../../modtracker/zzfxm-converted/k0w-rsnd.js';
import modmon from '../../modtracker/zzfxm-converted/modmon.js';
import musicJump from '../../modtracker/zzfxm-converted/music-jump.js';

const ROOM_TRACKS: readonly { readonly id: string; readonly song: unknown }[] = [
  { id: 'drozerix-ai-renaissance', song: drozerixAiRenaissance },
  { id: 'drozerix-stardust-jam', song: drozerixStardustJam },
  { id: 'fx-poly1', song: fxPoly1 },
  { id: 'hit', song: hit },
  { id: 'k0w-rsnd', song: k0wRsnd },
  { id: 'modmon', song: modmon },
  { id: 'music-jump', song: musicJump },
];

let lastPlayedId: string | null = null;

function pickRandomTrack(excludeId: string | null): (typeof ROOM_TRACKS)[number] {
  const pool =
    excludeId === null || ROOM_TRACKS.length <= 1
      ? [...ROOM_TRACKS]
      : ROOM_TRACKS.filter((t) => t.id !== excludeId);
  if (pool.length === 0) return ROOM_TRACKS[0]!;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** One decoded module loops until the next `room:entered` picks another (avoids constant re-render hitches). */
function playRandomTrackerLooped(): void {
  if (DebugConfig.enableMusic === false) return;
  if (!AudioManager.isUnlocked) return;
  const t = pickRandomTrack(lastPlayedId);
  lastPlayedId = t.id;
  ZzfxmMusicPlayer.start(t.song, {
    bufferCacheKey: t.id,
    loop: true,
  });
}

let roomMusicHooked = false;

function ensureRoomMusicHook(): void {
  if (roomMusicHooked) return;
  roomMusicHooked = true;
  GameEvents.on('room:entered', () => {
    playRandomTrackerLooped();
  });
}

/**
 * Starts a random looping tracker for the menu; each {@link GameEvents} `room:entered` switches
 * to a new random module (no immediate repeat when ≥2 tracks). Songs loop in-room instead of
 * chaining on end (which re-decoded buffers and caused noticeable hitches).
 */
export function startTrackerPlaylist(): void {
  ensureRoomMusicHook();
  if (DebugConfig.enableMusic === false) return;
  if (!AudioManager.isUnlocked) return;
  playRandomTrackerLooped();
}
