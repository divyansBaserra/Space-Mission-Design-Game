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
  private isHangarMode: boolean = false;

  constructor(isHangarMode: boolean = false) {
    this.isHangarMode = isHangarMode;
    this.buildStaticColliders();
  }

  public setHangarMode(isHangar: boolean) {
    if (this.isHangarMode !== isHangar) {
      this.isHangarMode = isHangar;
      this.buildStaticColliders();
    }
  }

  public buildStaticColliders() {
    this.colliders = [];

    // ========================================================================
    // 1. COMMAND DECK (X: -4.5 to +4.5, Z: 6.0 to 16.0, Y: 0 to 3.0)
    // ========================================================================
    // Ceiling Collider (prevents player flying or clipping through station roof)
    this.addBox(-4.8, 2.9, 5.8, 4.8, 3.6, 16.2, "cmd_ceiling");

    // South Wall Observation Window & Glass Barrier
    this.addBox(-4.8, 0.0, 15.6, 4.8, 0.7, 16.4, "cmd_south_low");
    this.addBox(-4.8, 2.4, 15.6, 4.8, 3.4, 16.4, "cmd_south_top");
    this.addBox(-4.8, 0.0, 15.6, -4.3, 3.4, 16.4, "cmd_south_corner_l");
    this.addBox(4.3, 0.0, 15.6, 4.8, 3.4, 16.4, "cmd_south_corner_r");
    this.addBox(-4.8, 0.6, 15.8, 4.8, 2.5, 16.4, "cmd_south_glass_barrier");

    // West Wall
    this.addBox(-4.8, 0.0, 6.0, -4.4, 3.2, 16.0, "cmd_west_wall");
    // East Wall
    this.addBox(4.4, 0.0, 6.0, 4.8, 3.2, 16.0, "cmd_east_wall");

    // Partition Wall between Command Deck and Workshop (Z = 6.0, door gap [-1.2, 1.2])
    this.addBox(-4.5, 0.0, 5.8, -1.2, 3.2, 6.2, "partition_cmd_ws_left");
    this.addBox(1.2, 0.0, 5.8, 4.5, 3.2, 6.2, "partition_cmd_ws_right");

    // Command Deck Center Holo-Table (solid pedestal & display envelope)
    this.addBox(-1.1, 0.0, 10.3, 1.1, 1.8, 12.7, "cmd_holo_table");

    // Flight Director Mission Console (West Wall at Z = 8.5)
    this.addBox(-4.6, 0.0, 7.2, -3.8, 2.4, 9.8, "cmd_flight_director_console");

    // ========================================================================
    // 2. ENGINEERING WORKSHOP (X: -4.5 to +4.5, Z: -5.0 to 6.0, Y: 0 to 3.0)
    // ========================================================================
    // Ceiling Collider
    this.addBox(-4.8, 2.9, -5.2, 4.8, 3.6, 6.2, "ws_ceiling");

    // West Wall
    this.addBox(-4.8, 0.0, -5.0, -4.4, 3.2, 6.0, "ws_west_wall");
    // East Wall
    this.addBox(4.4, 0.0, -5.0, 4.8, 3.2, 6.0, "ws_east_wall");

    if (this.isHangarMode) {
      // HANGAR SANDBOX: Central Magnetic Levitation Assembly Rig
      this.addBox(-1.1, 0.0, -0.4, 1.1, 0.7, 1.4, "hangar_rig_pedestal");
      // Hangar Workstation Consoles
      this.addBox(-4.2, 0.0, -2.4, -3.2, 1.2, -1.2, "hangar_console_chassis");
      this.addBox(3.2, 0.0, -2.4, 4.2, 1.2, -1.2, "hangar_console_solar");
      this.addBox(3.2, 0.0, 1.2, 4.2, 1.2, 2.4, "hangar_console_propulsion");
      this.addBox(-4.2, 0.0, 1.2, -3.2, 1.2, 2.4, "hangar_console_payload");
      this.addBox(-4.2, 0.0, 3.0, -3.2, 1.2, 4.2, "hangar_console_telecom");
      this.addBox(-0.6, 0.0, 2.0, 0.6, 1.1, 2.8, "hangar_console_static_fire");
    } else {
      // ORBITAL REPAIR: Left & Right Workbenches
      // Left Workbench (holds Toolkit)
      this.addBox(-4.5, 0.0, -1.2, -3.1, 1.2, 2.2, "ws_table_left");
      // Right Workbench (holds Solar Wing & Antenna)
      this.addBox(3.1, 0.0, -1.2, 4.5, 1.2, 2.2, "ws_table_right");
      // Spacesuit Display Rack / Mannequin
      this.addBox(-4.2, 0.0, 4.2, -2.9, 2.4, 5.4, "ws_spacesuit_rack");
    }

    // Partition Wall between Workshop and Airlock (Z = -5.0, door gap [-1.1, 1.1])
    this.addBox(-4.5, 0.0, -5.2, -1.1, 3.2, -4.8, "partition_ws_airlock_left");
    this.addBox(1.1, 0.0, -5.2, 4.5, 3.2, -4.8, "partition_ws_airlock_right");

    // ========================================================================
    // 3. AIRLOCK (X: -2.0 to +2.0, Z: -11.0 to -5.0, Y: 0 to 3.0)
    // ========================================================================
    // Ceiling Collider
    this.addBox(-2.5, 2.9, -11.2, 2.5, 3.6, -4.8, "airlock_ceiling");

    // West Wall
    this.addBox(-2.3, 0.0, -11.0, -1.9, 3.2, -5.0, "airlock_west_wall");
    // East Wall
    this.addBox(1.9, 0.0, -11.0, 2.3, 3.2, -5.0, "airlock_east_wall");

    // Airlock Console on West Wall
    this.addBox(-2.0, 0.6, -8.7, -1.3, 1.8, -7.3, "airlock_console_box");

    // Outer Bulkhead Wall (Z = -11.0, door gap [-1.1, 1.1])
    this.addBox(-4.5, 0.0, -11.4, -1.1, 3.4, -10.8, "airlock_outer_wall_left");
    this.addBox(1.1, 0.0, -11.4, 4.5, 3.4, -10.8, "airlock_outer_wall_right");
    this.addBox(-1.2, 2.4, -11.4, 1.2, 3.4, -10.8, "airlock_outer_lintel");

    // ========================================================================
    // 4. EXTERIOR GANTRY & EVA BOUNDS
    // ========================================================================
    // Gantry Safety Handrails (perfectly aligned with walkway edges at X = +/- 2.1m)
    this.addBox(-2.8, -0.4, -31.5, -2.05, 2.2, -11.0, "gantry_rail_left");
    this.addBox(2.05, -0.4, -31.5, 2.8, 2.2, -11.0, "gantry_rail_right");
    this.addBox(-2.8, -0.4, -31.0, 2.8, 2.2, -30.1, "gantry_rail_end");

    // Satellite `AERO-3X` Solid Hull & Solar Arrays (at Z = -22.0)
    this.addBox(-0.7, 0.0, -22.7, 0.7, 2.5, -21.3, "satellite_core_chassis");
    this.addBox(-1.9, 0.8, -22.4, -0.7, 2.2, -21.6, "satellite_array_left");
    this.addBox(0.7, 0.8, -22.4, 1.9, 2.2, -21.6, "satellite_array_right");

    // Space Shuttle `ORV-1` at Mooring Berth (Z = -36.5)
    // Prevents player walking straight into the external tank, SRBs, or fuselage!
    this.addBox(-3.2, -0.8, -43.0, 3.2, 5.0, -32.0, "shuttle_fuselage_tank");
    this.addBox(-5.5, -0.8, -43.0, -2.5, 3.5, -34.5, "shuttle_wing_srb_left");
    this.addBox(2.5, -0.8, -43.0, 5.5, 3.5, -34.5, "shuttle_wing_srb_right");
    this.addBox(-0.9, -0.8, -37.0, 0.9, 0.9, -34.0, "shuttle_cradle_stanchion");

    // ========================================================================
    // 5. LUNAR BASE ALPHA SURFACE OBSTACLES (Z = -110.0, Y = -18.0)
    // ========================================================================
    // Space Shuttle on PAD-01 Landing Pad (Z = -110.0)
    this.addBox(-1.6, -18.0, -113.8, 1.6, -12.2, -107.2, "lunar_shuttle_fuselage");
    this.addBox(-3.4, -18.0, -113.2, -1.6, -13.5, -108.0, "lunar_shuttle_wing_l");
    this.addBox(1.6, -18.0, -113.2, 3.4, -13.5, -108.0, "lunar_shuttle_wing_r");

    // Habitat Module at [16.0, -18.0, -102.0]
    this.addBox(11.0, -18.0, -107.0, 21.0, -11.0, -97.0, "lunar_base_habitat");
    // Communications Mast at [-14.0, -18.0, -100.0]
    this.addBox(-15.5, -18.0, -101.5, -12.5, -8.0, -98.5, "lunar_comms_mast");
    // Cryogenic Storage Tanks
    this.addBox(7.0, -18.0, -96.0, 13.5, -12.0, -92.0, "lunar_cryo_tanks");
    // Surface Radiation Shields
    this.addBox(-13.5, -18.0, -97.5, -10.5, -15.5, -94.5, "lunar_shield_l");
    this.addBox(10.5, -18.0, -97.5, 13.5, -15.5, -94.5, "lunar_shield_r");

    // ========================================================================
    // 6. LUNAR BASE ALPHA PERIMETER BOULDERS & CRATER RIM SCATTER
    // ========================================================================
    // West Rim Boulder
    this.addBox(-13.5, -18.0, -119.0, -11.5, -16.6, -117.0, "lunar_boulder_w");
    // Northwest Crater Rim Rock
    this.addBox(-17.3, -18.0, -126.2, -14.7, -16.0, -123.8, "lunar_boulder_nw");
    // North Crater Edge Megalith
    this.addBox(-3.5, -18.0, -129.5, -0.5, -15.8, -126.5, "lunar_boulder_n");
    // Northeast Ejecta Rock
    this.addBox(12.8, -18.0, -127.2, 15.2, -16.3, -124.8, "lunar_boulder_ne");
    // East Ridge Basalt Rock
    this.addBox(17.6, -18.0, -117.3, 20.4, -16.1, -114.7, "lunar_boulder_e");
    // Southeast Outcropping
    this.addBox(13.9, -18.0, -99.0, 16.1, -16.5, -97.0, "lunar_boulder_se");
    // Southwest Ejecta Boulder
    this.addBox(-19.3, -18.0, -107.2, -16.7, -16.2, -104.8, "lunar_boulder_sw");
    // South Perimeter Rock
    this.addBox(-9.0, -18.0, -97.0, -7.0, -16.7, -95.0, "lunar_boulder_s");
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
   * Resolves player movement with full 3-axis AABB collision, pushout, and continuous sliding.
   * Proactive depenetration guarantees the player can never be inside any physical object.
   */
  public movePlayer(
    currentPos: THREE.Vector3,
    desiredDelta: THREE.Vector3,
    radius: number = 0.52
  ): { finalPos: THREE.Vector3; collided: boolean } {
    const nextPos = currentPos.clone();
    let collided = false;
    const playerHeight = 1.9; // 1.9m total vertical clearance envelope

    // 1. Multi-axis movement test with proactive surface clamping
    const testAxes: { axis: "x" | "y" | "z"; delta: number }[] = [
      { axis: "x", delta: desiredDelta.x },
      { axis: "z", delta: desiredDelta.z },
      { axis: "y", delta: desiredDelta.y },
    ];

    for (const { axis, delta } of testAxes) {
      if (Math.abs(delta) < 0.00001) continue;

      const candidatePos = nextPos.clone();
      candidatePos[axis] += delta;

      for (const col of this.colliders) {
        if (col.isTrigger) continue;

        const pMinX = candidatePos.x - radius;
        const pMaxX = candidatePos.x + radius;
        const pMinZ = candidatePos.z - radius;
        const pMaxZ = candidatePos.z + radius;
        const pMinY = candidatePos.y;
        const pMaxY = candidatePos.y + playerHeight;

        // Overlap detection
        if (
          pMaxX > col.min.x &&
          pMinX < col.max.x &&
          pMaxZ > col.min.z &&
          pMinZ < col.max.z &&
          pMaxY > col.min.y &&
          pMinY < col.max.y
        ) {
          collided = true;

          // Proactive surface clamping: snap directly to the outer surface of the collider
          if (axis === "x") {
            if (delta > 0) {
              candidatePos.x = col.min.x - radius - 0.003;
            } else {
              candidatePos.x = col.max.x + radius + 0.003;
            }
          } else if (axis === "z") {
            if (delta > 0) {
              candidatePos.z = col.min.z - radius - 0.003;
            } else {
              candidatePos.z = col.max.z + radius + 0.003;
            }
          } else if (axis === "y") {
            if (delta > 0) {
              candidatePos.y = col.min.y - playerHeight - 0.003;
            } else {
              candidatePos.y = col.max.y + 0.003;
            }
          }
          break;
        }
      }

      nextPos[axis] = candidatePos[axis];
    }

    // 2. Proactive Depenetration Pass (up to 3 iterations)
    // Ensures that even if the player started inside or clipped across corners,
    // they are forcefully nudged out along the minimum penetration axis.
    for (let iter = 0; iter < 3; iter++) {
      let anyPenetration = false;

      for (const col of this.colliders) {
        if (col.isTrigger) continue;

        const pMinX = nextPos.x - radius;
        const pMaxX = nextPos.x + radius;
        const pMinZ = nextPos.z - radius;
        const pMaxZ = nextPos.z + radius;
        const pMinY = nextPos.y;
        const pMaxY = nextPos.y + playerHeight;

        if (
          pMaxX > col.min.x &&
          pMinX < col.max.x &&
          pMaxZ > col.min.z &&
          pMinZ < col.max.z &&
          pMaxY > col.min.y &&
          pMinY < col.max.y
        ) {
          anyPenetration = true;
          collided = true;

          // Calculate overlap on each side
          const overlapLeft = pMaxX - col.min.x;
          const overlapRight = col.max.x - pMinX;
          const overlapNorth = col.max.z - pMinZ;
          const overlapSouth = pMaxZ - col.min.z;
          const overlapDown = col.max.y - pMinY;
          const overlapUp = pMaxY - col.min.y;

          const minXOverlap = Math.min(overlapLeft, overlapRight);
          const minZOverlap = Math.min(overlapNorth, overlapSouth);
          const minYOverlap = Math.min(overlapDown, overlapUp);

          // Push out along the shallowest penetration axis
          if (minXOverlap <= minZOverlap && minXOverlap <= minYOverlap) {
            if (overlapLeft < overlapRight) {
              nextPos.x = col.min.x - radius - 0.004;
            } else {
              nextPos.x = col.max.x + radius + 0.004;
            }
          } else if (minZOverlap <= minXOverlap && minZOverlap <= minYOverlap) {
            if (overlapSouth < overlapNorth) {
              nextPos.z = col.min.z - radius - 0.004;
            } else {
              nextPos.z = col.max.z + radius + 0.004;
            }
          } else {
            if (overlapUp < overlapDown) {
              nextPos.y = col.min.y - playerHeight - 0.004;
            } else {
              nextPos.y = col.max.y + 0.004;
            }
          }
        }
      }

      if (!anyPenetration) break;
    }

    // 3. World boundary guards
    if (nextPos.z < -11.0 && nextPos.z >= -55.0 && nextPos.y >= -10.0) {
      // Exterior orbital station gantry bounds (prevent clipping off gantry or into shuttle)
      nextPos.x = THREE.MathUtils.clamp(nextPos.x, -2.0, 2.0);
      nextPos.z = THREE.MathUtils.clamp(nextPos.z, -30.0, -11.0);
      nextPos.y = THREE.MathUtils.clamp(nextPos.y, 0.05, 4.0);
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
