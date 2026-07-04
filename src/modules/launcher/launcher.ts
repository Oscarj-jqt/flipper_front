import * as THREE from "three";
import type { Ball } from "@modules/ball";

export interface LauncherOptions {
  /** Demi-largeur (axe X) de la zone de lancement, en unités monde. */
  zoneHalfWidth?: number;
  /** Étendue de la zone vers l'arrière (butée du plunger). */
  zoneBackMargin?: number;
  /** Étendue de la zone vers l'avant (sortie du couloir vers le plateau). */
  zoneFrontMargin?: number;
}

/**
 * Plunger (lanceur à ressort) sans asset 3D dédié : la bille passe sous le
 * tunnel de lancement donc le plunger n'est jamais visible, seul le
 * comportement physique compte.
 *
 * - Appuyer sur Espace arme instantanément le lanceur à sa puissance maximale.
 * - Relâcher Espace frappe la bille avec une impulsion fixe vers l'avant
 *   (axe +z du couloir).
 * - Le plunger n'agit (ni armement, ni frappe) que si la bille est physiquement
 *   présente dans le couloir de lancement.
 */
export class Launcher {
  mesh: THREE.Mesh;
  // State
  private isArmed = false;

  private readonly zoneCenter: THREE.Vector2;
  private readonly zoneHalfWidth: number;
  private readonly zoneBackMargin: number;
  private readonly zoneFrontMargin: number;

  private ball: Ball;

  private initialZ: number;
  // Constructor
  constructor(ball: Ball, options: LauncherOptions = {}) {
    this.ball = ball;

    const geometry = new THREE.CylinderGeometry(0.2, 0.2, 2, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 });

    this.mesh = new THREE.Mesh(geometry, material);

    // Position
    this.mesh.position.set(-7.6, 4.9, -13.4);

    // Inclinaison
    // léger angle vers la table
    this.mesh.rotation.x = -Math.PI / 3; // ~ -60°
    this.mesh.rotation.z = 0.15; // léger décalage esthétique

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.initialZ = this.mesh.position.z;

    // Zone de lancement : couloir étroit autour du plunger. La bille y
    // démarre (cf. `initialPosition` de `Ball`) et doit y rester pour que le
    // plunger puisse s'armer/frapper.
    this.zoneCenter = new THREE.Vector2(this.mesh.position.x, this.mesh.position.z);
    this.zoneHalfWidth = options.zoneHalfWidth ?? 0.45;
    this.zoneBackMargin = options.zoneBackMargin ?? 0.6;
    this.zoneFrontMargin = options.zoneFrontMargin ?? 3.2;
  }

  /** Vrai si la bille est actuellement dans le couloir de lancement. */
  isBallInLaunchZone(): boolean {
    const position = this.ball.mesh.position;

    const dx = Math.abs(position.x - this.zoneCenter.x);
    if (dx > this.zoneHalfWidth) return false;

    const dz = position.z - this.zoneCenter.y;
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

  update(_deltaTime?: number) {
    if (this.isArmed) {
      // Sécurité : si la bille sort du couloir pendant l'armement, on
      // annule proprement (le plunger ne doit agir que sur une bille présente).
      if (!this.isBallInLaunchZone()) {
        this.isArmed = false;
      }
    }

    // Animation (la compression visuelle n'est jamais rendue, cf. docstring,
    // mais reste utile pour du debug / une future GUI).
    const compression = this.isArmed ? 1 : 0;
    this.mesh.position.z = this.initialZ + compression * 0.75;
  }

  addTo(scene: THREE.Scene) {
    scene.add(this.mesh);
  }
}
