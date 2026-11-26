import { describe, expect, it, vi } from "vitest";

import type { Ball } from "@modules/ball";
import { Launcher } from "./launcher";

function makeBall(position = { x: -7.6, y: 4.92, z: -8.9 }) {
  const body = {
    linvel: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
    setLinvel: vi.fn(),
  };
  const ball = {
    mesh: { position },
    getBody: vi.fn(() => body),
    allowTemporaryMaxLinearSpeed: vi.fn(),
    applyImpulse: vi.fn(),
  } as unknown as Ball;

  return { ball, body };
}

describe("Launcher", () => {
  it("accepte la position initiale de la bille dans la zone de lancement", () => {
    const { ball } = makeBall();
    const launcher = new Launcher(ball);

    expect(launcher.isBallInLaunchZone()).toBe(true);
  });

  it("propulse la bille après un armement valide", () => {
    const { ball, body } = makeBall();
    const launcher = new Launcher(ball);

    launcher.startCharge();
    launcher.release();

    expect(ball.allowTemporaryMaxLinearSpeed).toHaveBeenCalledWith(18, 3);
    expect(body.setLinvel).toHaveBeenCalledWith({ x: 0, y: 0, z: 15 }, true);
    expect(ball.applyImpulse).toHaveBeenCalledWith({ x: 0, y: 0, z: 2.2 });
  });
});
