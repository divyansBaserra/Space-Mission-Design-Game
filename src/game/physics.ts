"use client";

import * as THREE from "three";

export interface BoxCollider {
  min: THREE.Vector3;
  max: THREE.Vector3;
  name?: string;
  isTrigger?: boolean;
}

export interface PlayerPhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  isEva: boolean;
}

export class StationPhysics {
  public colliders: BoxCollider[] = [];

  constructor() {
    this.buildStaticColliders();
  }

  public buildStaticColliders() {
    this.colliders = [];

    // ========================================================================
    // 1. COMMAND DECK (X: -4.5 to +4.5, Z: 6.0 to 16.0, Y: 0 to 3.0)
    // ========================================================================
    // South Wall (window frame base & top)
    this.addBox(-4.5, 0.0, 15.8, 4.5, 0.6, 16.4, "cmd_south_low");
    this.addBox(-4.5, 2.5, 15.8, 4.5, 3.2, 16.4, "cmd_south_top");
    this.addBox(-4.8, 0.0, 15.8, -4.3, 3.2, 16.4, "cmd_south_corner_l");
    this.addBox(4.3, 0.0, 15.8, 4.8, 3.2, 16.4, "cmd_south_corner_r");

    // West Wall
    this.addBox(-4.8, 0.0, 6.0, -4.4, 3.2, 16.0, "cmd_west_wall");
    // East Wall
    this.addBox(4.4, 0.0, 6.0, 4.8, 3.2, 16.0, "cmd_east_wall");

    // Partition Wall between Command Deck and Workshop (Z = 6.0, door gap [-1.2, 1.2])
    this.addBox(-4.5, 0.0, 5.8, -1.2, 3.2, 6.2, "partition_cmd_ws_left");
    this.addBox(1.2, 0.0, 5.8, 4.5, 3.2, 6.2, "partition_cmd_ws_right");

    // Command Deck Center Holo-Table
    this.addBox(-1.0, 0.0, 10.5, 1.0, 0.9, 12.5, "cmd_table");

    // ========================================================================
    // 2. ENGINEERING WORKSHOP (X: -4.5 to +4.5, Z: -5.0 to 6.0, Y: 0 to 3.0)
    // ========================================================================
    // West Wall
    this.addBox(-4.8, 0.0, -5.0, -4.4, 3.2, 6.0, "ws_west_wall");
    // East Wall
    this.addBox(4.4, 0.0, -5.0, 4.8, 3.2, 6.0, "ws_east_wall");

    // Workshop Tables
    // Left Workbench (holds Toolkit)
    this.addBox(-4.3, 0.0, -1.0, -3.1, 0.9, 2.0, "ws_table_left");
    // Right Workbench (holds Solar Wing & Antenna)
    this.addBox(3.1, 0.0, -1.0, 4.3, 0.9, 2.0, "ws_table_right");

    // Partition Wall between Workshop and Airlock (Z = -5.0, door gap [-1.1, 1.1])
    this.addBox(-4.5, 0.0, -5.2, -1.1, 3.2, -4.8, "partition_ws_airlock_left");
    this.addBox(1.1, 0.0, -5.2, 4.5, 3.2, -4.8, "partition_ws_airlock_right");

    // ========================================================================
    // 3. AIRLOCK (X: -2.0 to +2.0, Z: -11.0 to -5.0, Y: 0 to 3.0)
    // ========================================================================
    // West Wall
    this.addBox(-2.3, 0.0, -11.0, -1.9, 3.2, -5.0, "airlock_west_wall");
    // East Wall
    this.addBox(1.9, 0.0, -11.0, 2.3, 3.2, -5.0, "airlock_east_wall");

    // Airlock Console on West Wall
    this.addBox(-1.9, 0.8, -8.5, -1.4, 1.6, -7.5, "airlock_console_box");

    // Outer Bulkhead Wall (Z = -11.0, door gap [-1.1, 1.1])
    this.addBox(-4.0, 0.0, -11.2, -1.1, 3.2, -10.8, "airlock_outer_wall_left");
    this.addBox(1.1, 0.0, -11.2, 4.0, 3.2, -10.8, "airlock_outer_wall_right");

    // ========================================================================
    // 4. EXTERIOR GANTRY & EVA BOUNDS
    // ========================================================================
    // Gantry Floor Barrier / Rails (stops accidental walks off edge without jetpack)
    this.addBox(-3.2, -0.2, -32.0, -2.8, 1.2, -11.0, "gantry_rail_left");
    this.addBox(2.8, -0.2, -32.0, 3.2, 1.2, -11.0, "gantry_rail_right");
    this.addBox(-3.2, -0.2, -32.4, 3.2, 1.2, -32.0, "gantry_rail_end");

    // Satellite Docking Stand
    this.addBox(-0.6, 0.0, -22.6, 0.6, 0.7, -21.4, "satellite_dock_base");

    // ========================================================================
    // 5. LUNAR BASE ALPHA SURFACE OBSTACLES (around Z = -110.0, Y = -18.0)
    // ========================================================================
    // Habitat Module at [16.0, -18.0, -102.0]
    this.addBox(12.0, -18.0, -106.0, 20.0, -12.0, -98.0, "lunar_base_habitat");
    // Communications Mast at [-14.0, -18.0, -100.0]
    this.addBox(-15.0, -18.0, -101.0, -13.0, -10.0, -99.0, "lunar_comms_mast");
  }

  private addBox(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
    name?: string,
    isTrigger: boolean = false
  ) {
    this.colliders.push({
      min: new THREE.Vector3(minX, minY, minZ),
      max: new THREE.Vector3(maxX, maxY, maxZ),
      name,
      isTrigger,
    });
  }

  /**
   * Updates dynamic colliders such as inner/outer airlock doors
   */
  public updateDoorColliders(innerDoorOpen: boolean, outerDoorOpen: boolean) {
    // Remove existing door colliders
    this.colliders = this.colliders.filter(
      (c) => c.name !== "inner_door_closed" && c.name !== "outer_door_closed"
    );

    if (!innerDoorOpen) {
      // Inner door at Z = -5.0, X: [-1.2, 1.2]
      this.addBox(-1.15, 0.0, -5.2, 1.15, 3.0, -4.8, "inner_door_closed");
    }

    if (!outerDoorOpen) {
      // Outer door at Z = -11.0, X: [-1.2, 1.2]
      this.addBox(-1.15, 0.0, -11.2, 1.15, 3.0, -10.8, "outer_door_closed");
    }
  }

  /**
   * Resolves player movement with full 3-axis AABB collision and sliding
   */
  public movePlayer(
    currentPos: THREE.Vector3,
    desiredDelta: THREE.Vector3,
    radius: number = 0.35
  ): { finalPos: THREE.Vector3; collided: boolean } {
    const nextPos = currentPos.clone();
    let collided = false;

    // Test axis by axis (X, Y, Z) for smooth wall sliding and solid footing
    const testAxes = [
      new THREE.Vector3(desiredDelta.x, 0, 0),
      new THREE.Vector3(0, desiredDelta.y, 0),
      new THREE.Vector3(0, 0, desiredDelta.z),
    ];

    for (const axisDelta of testAxes) {
      if (axisDelta.lengthSq() === 0) continue;
      const candidatePos = nextPos.clone().add(axisDelta);
      let axisCollided = false;

      // Check against all static colliders
      for (const col of this.colliders) {
        if (col.isTrigger) continue;

        // Player AABB at candidate position (Y: player feet to head)
        const pMinX = candidatePos.x - radius;
        const pMaxX = candidatePos.x + radius;
        const pMinZ = candidatePos.z - radius;
        const pMaxZ = candidatePos.z + radius;
        const pMinY = candidatePos.y;
        const pMaxY = candidatePos.y + 1.7;

        // Overlap test
        if (
          pMaxX > col.min.x &&
          pMinX < col.max.x &&
          pMaxZ > col.min.z &&
          pMinZ < col.max.z &&
          pMaxY > col.min.y &&
          pMinY < col.max.y
        ) {
          axisCollided = true;
          collided = true;
          break;
        }
      }

      if (!axisCollided) {
        nextPos.add(axisDelta);
      }
    }

    // World boundary guards
    if (nextPos.z < -11.0 && nextPos.z >= -55.0 && nextPos.y >= -10.0) {
      // Exterior orbital station gantry bounds
      nextPos.x = THREE.MathUtils.clamp(nextPos.x, -12.0, 12.0);
      nextPos.z = THREE.MathUtils.clamp(nextPos.z, -48.0, -11.0);
      nextPos.y = THREE.MathUtils.clamp(nextPos.y, -4.0, 8.0);
    } else if (nextPos.z < -55.0 || nextPos.y < -10.0) {
      // Lunar Base Alpha surface boundary guard (prevent walking off terrain)
      nextPos.x = THREE.MathUtils.clamp(nextPos.x, -65.0, 65.0);
      nextPos.z = THREE.MathUtils.clamp(nextPos.z, -160.0, -60.0);
      nextPos.y = Math.max(-18.0, nextPos.y);
    }

    return { finalPos: nextPos, collided };
  }

  /**
   * Resolves spacecraft flight collision against station modules, gantry, and surface terrain
   */
  public resolveSpacecraftCollision(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    craftRadius: number = 2.2,
    surfaceY: number = -18.0
  ): {
    newPos: THREE.Vector3;
    newVel: THREE.Vector3;
    collided: boolean;
    surfaceContact: boolean;
    obstacleName?: string;
  } {
    const newPos = pos.clone();
    const newVel = vel.clone();
    let collided = false;
    let surfaceContact = false;
    let obstacleName: string | undefined;

    // 1. Surface Terrain & Landing Zone Collision (Floor Plane)
    // Craft landing gear/hull sits at surfaceY + craftRadius
    const groundFloor = surfaceY + craftRadius;
    if (newPos.y <= groundFloor) {
      newPos.y = groundFloor;
      if (newVel.y < 0) {
        newVel.y = 0;
      }
      surfaceContact = true;
      collided = true;
      obstacleName = "surface_terrain";
    }

    // 2. Station Module Obstacles (AABB vs Sphere)
    for (const col of this.colliders) {
      if (col.isTrigger) continue;

      // Find closest point on collider AABB to spacecraft center
      const closestX = Math.max(col.min.x, Math.min(newPos.x, col.max.x));
      const closestY = Math.max(col.min.y, Math.min(newPos.y, col.max.y));
      const closestZ = Math.max(col.min.z, Math.min(newPos.z, col.max.z));

      const dx = newPos.x - closestX;
      const dy = newPos.y - closestY;
      const dz = newPos.z - closestZ;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < craftRadius * craftRadius) {
        collided = true;
        obstacleName = col.name ?? "station_hull";

        const dist = Math.sqrt(distSq);
        const normal =
          dist > 0.001
            ? new THREE.Vector3(dx / dist, dy / dist, dz / dist)
            : new THREE.Vector3(0, 1, 0);

        // Push spacecraft out of obstacle volume
        const penetration = craftRadius - dist;
        newPos.addScaledVector(normal, penetration);

        // Reflect velocity with elastic damping
        const dot = newVel.dot(normal);
        if (dot < 0) {
          newVel.addScaledVector(normal, -1.45 * dot);
        }
      }
    }

    return {
      newPos,
      newVel,
      collided,
      surfaceContact,
      obstacleName,
    };
  }
}
