import type { UpgradeType, PickupType } from '../types/GameTypes';

type EventHandler<T> = (payload: T) => void;

export interface GameEventMap {
  'enemy:hit':        { damage: number; x: number; y: number };
  'enemy:died':       { points: number; x: number; y: number };
  'player:hit':       { damage: number };
  'player:upgraded':  { upgradeType: UpgradeType };
  'player:downgraded':{ upgradeType: UpgradeType };
  'bullet:fired':     Record<string, never>;
  'panic:deployed':   { damage: number };
  'score:changed':    { score: number };
  'health:changed':   { current: number; max: number };
  'fleet:lost':       Record<string, never>;
  'game:over':        Record<string, never>;
  'game:won':         Record<string, never>;
  'pickup:collected':    { pickupType: PickupType };
  'room:entered':        { isBoss: boolean };
  'room:cleared':        Record<string, never>;
  'enemy:spawned':       Record<string, never>;
  'wrangler:tether':     { active: boolean };
  'zapsphere:warning':   { active: boolean };
  'zapsphere:lightning': Record<string, never>;
}

class TypedEventBus {
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.listeners.get(event)?.forEach(h => h(payload));
  }
}

export const GameEvents = new TypedEventBus();
