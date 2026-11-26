import type { Ball } from "@modules/ball";

const LAUNCH_ZONE_CENTER = {
  x: -7.6,
  z: -13.4,
} as const;

const DEFAULT_ZONE_HALF_WIDTH = 0.45;
const DEFAULT_ZONE_BACK_MARGIN = 0.6;
// La bille démarre à z = -8.9, soit 4.5 unités devant le centre du lanceur.
const DEFAULT_ZONE_FRONT_MARGIN = 4.8;

export interface LauncherOptions {
  /** Demi-largeur (axe X) de la zone de lancement, en unités monde. */
  zoneHalfWidth?: number;
  /** Étendue de la zone vers l'arrière (butée du plunger). */
  zoneBackMargin?: number;
  /** Étendue de la zone vers l'avant (sortie du couloir vers le plateau). */
  zoneFrontMargin?: number;
}

/**
 * Plunger (lanceur à ressort) sans asset 3D dédié : seul le comportement
 * physique compte.
 *
 * - Appuyer sur Espace arme instantanément le lanceur à sa puissance maximale.
 * - Relâcher Espace frappe la bille avec une impulsion fixe vers l'avant
 *   (axe +z du couloir).
 * - Le plunger n'agit (ni armement, ni frappe) que si la bille est physiquement
 *   présente dans le couloir de lancement.
 */
export class Launcher {
  // State
  private isArmed = false;

  private readonly zoneCenterX: number;
  private readonly zoneCenterZ: number;
  private readonly zoneHalfWidth: number;
  private readonly zoneBackMargin: number;
  private readonly zoneFrontMargin: number;

  private readonly ball: Ball;

  // Constructor
  constructor(ball: Ball, options: LauncherOptions = {}) {
    this.ball = ball;

    // Zone de lancement : couloir étroit autour du plunger virtuel. La bille y
    // démarre (cf. `initialPosition` de `Ball`) et doit y rester pour que le
    // lanceur puisse s'armer/frapper.
    this.zoneCenterX = LAUNCH_ZONE_CENTER.x;
    this.zoneCenterZ = LAUNCH_ZONE_CENTER.z;
    this.zoneHalfWidth = options.zoneHalfWidth ?? DEFAULT_ZONE_HALF_WIDTH;
    this.zoneBackMargin = options.zoneBackMargin ?? DEFAULT_ZONE_BACK_MARGIN;
    this.zoneFrontMargin = options.zoneFrontMargin ?? DEFAULT_ZONE_FRONT_MARGIN;
  }

  /** Vrai si la bille est actuellement dans le couloir de lancement. */
  isBallInLaunchZone(): boolean {
    const position = this.ball.mesh.position;

    const dx = Math.abs(position.x - this.zoneCenterX);
    if (dx > this.zoneHalfWidth) return false;

    const dz = position.z - this.zoneCenterZ;
    return dz >= -this.zoneBackMargin && dz <= this.zoneFrontMargin;
  }

  /** Arme le lanceur à puissance maximale. L'input est câblé en dehors. */
  startCharge(): void {
    if (this.isArmed) return;
    // Pas d'armement si la bille n'est pas dans le couloir : on ne veut pas
    // qu'Espace ait un effet quelconque ailleurs sur le plateau.
    if (!this.isBallInLaunchZone()) return;

    this.isArmed = true;
  }

  /** Relâche le lanceur : propulse la bille à puissance fixe. */
  release(): void {
    if (!this.isArmed) return;
    this.isArmed = false;

    // Si la bille a quitté le couloir pendant l'armement (cas limite), on
    // n'applique aucune frappe : le plunger n'agit que sur une bille présente.
    if (!this.isBallInLaunchZone()) return;

    // Impulsion vers le haut de la table Blender (axe +z).
    // Puissance fixe équivalente à l'ancienne charge maximale.
    const body = this.ball.getBody();
    if (!body) return;

    this.ball.allowTemporaryMaxLinearSpeed(18, 3);
    const velocity = body.linvel();
    body.setLinvel(
      {
        x: velocity.x * 0.35,
        y: Math.max(velocity.y, 0),
        z: Math.max(velocity.z, 15),
      },
      true,
    );
    this.ball.applyImpulse({ x: 0, y: 0, z: 2.2 });
  }

  update(_deltaTime?: number): void {
    if (this.isArmed) {
      // Sécurité : si la bille sort du couloir pendant l'armement, on
      // annule proprement (le plunger ne doit agir que sur une bille présente).
      if (!this.isBallInLaunchZone()) {
        this.isArmed = false;
      }
    }
  }
}
