import { ControlInput, HillClimbState, LevelConfig, ObstacleItem, TimeOfDayLabel } from './types';
import { sound } from './audio';
import { LEVELS } from './levels';

export class HillClimbPhysics {
  public x = 0;
  public y = 1.0;
  public theta = 0;

  public vx = 0;
  public vy = 0;
  public omega = 0;

  public frontWheelGrounded = false;
  public rearWheelGrounded = false;
  public frontSuspensionY = 0;
  public rearSuspensionY = 0;

  public airTime = 0;
  public rotationAccumulator = 0;
  public flips = 0;
  private invertedStuckTimer = 0;
  private outOfFuelTimer = 0;
  private lastSafeGroundY = 0;
  private prevSlope = 0;
  private wasGrounded = true;
  private hasStartedDriving = false;

  private level: LevelConfig = LEVELS[0];
  private totalLevelCoins = 100;

  public state: HillClimbState = {
    levelId: 1,
    levelName: LEVELS[0].name,
    levelLength: LEVELS[0].length,
    distance: 0,
    coinsCollected: 0,
    totalLevelCoins: 100,
    score: 0,
    fuel: 100,
    health: 100,
    speed: 0,
    inAir: false,
    airTime: 0,
    flips: 0,
    isCrashed: false,
    crashReason: null,
    isLevelComplete: false,
    starsEarned: 0,
    bonusReward: 0,
    timeOfDay: 'Morning',
    headlightsOn: false,
  };

  private readonly wheelBase = 1.35;
  private readonly wheelRadius = 0.65;
  private readonly axleOffsetY = -0.35;
  private readonly gravity = 22.0;
  private readonly maxForwardSpeed = 31;
  private readonly maxReverseSpeed = -12;

  public reset(level: LevelConfig = this.level, totalCoins = this.totalLevelCoins) {
    this.level = level;
    this.totalLevelCoins = Math.max(1, totalCoins);

    this.x = 0;
    this.y = 0.88;
    this.theta = 0;
    this.vx = 0;
    this.vy = 0;
    this.omega = 0;
    this.frontWheelGrounded = false;
    this.rearWheelGrounded = false;
    this.frontSuspensionY = 0;
    this.rearSuspensionY = 0;
    this.airTime = 0;
    this.rotationAccumulator = 0;
    this.flips = 0;
    this.invertedStuckTimer = 0;
    this.outOfFuelTimer = 0;
    this.lastSafeGroundY = 0;
    this.prevSlope = 0;
    this.wasGrounded = true;
    this.hasStartedDriving = false;

    this.state = {
      levelId: level.id,
      levelName: level.name,
      levelLength: level.length,
      distance: 0,
      coinsCollected: 0,
      totalLevelCoins: this.totalLevelCoins,
      score: 0,
      fuel: 100,
      health: 100,
      speed: 0,
      inAir: false,
      airTime: 0,
      flips: 0,
      isCrashed: false,
      crashReason: null,
      isLevelComplete: false,
      starsEarned: 0,
      bonusReward: 0,
      timeOfDay: 'Morning',
      headlightsOn: false,
    };
  }

  public setAtmosphereInfo(timeOfDay: TimeOfDayLabel, headlightsOn: boolean) {
    this.state.timeOfDay = timeOfDay;
    this.state.headlightsOn = headlightsOn;
  }

  private triggerGameOver(reason: string, soundType: 'crash' | 'gap' | 'none' = 'crash') {
    this.state.isCrashed = true;
    this.state.crashReason = reason;
    this.vx = 0;
    this.vy = 0;
    this.omega = 0;
    this.state.speed = 0;
    sound.updateEngine(0, false);
    if (soundType === 'gap') {
      sound.playGapFall();
    } else if (soundType === 'crash') {
      sound.playCrash();
    }
  }

  public update(
    delta: number,
    input: ControlInput,
    getY: (x: number) => number,
    getSlope: (x: number) => number,
    obstacles: ObstacleItem[],
    onStunt: (msg: string, bonus: number) => void,
    onObstacleHit: () => void
  ) {
    if (this.state.isCrashed || this.state.isLevelComplete) return;

    // 1. Fuel consumption (drains once the player starts driving)
    if (input.gas || input.brake || Math.abs(this.vx) > 0.25) {
      this.hasStartedDriving = true;
    }

    const isAccelerating = input.gas && this.state.fuel > 0;
    if (this.hasStartedDriving && this.state.fuel > 0) {
      const burnRate = isAccelerating ? this.level.fuelBurnRate : this.level.fuelBurnRate * 0.42;
      this.state.fuel = Math.max(0, this.state.fuel - delta * burnRate);
    }

    if (this.state.fuel <= 0) {
      this.outOfFuelTimer += delta;
      if (Math.abs(this.vx) < 0.6 || this.outOfFuelTimer >= 2.0) {
        this.triggerGameOver('Out of Fuel!', 'none');
        return;
      }
    } else {
      this.outOfFuelTimer = 0;
    }

    // 2. Wheel positions relative to chassis
    const cosT = Math.cos(this.theta);
    const sinT = Math.sin(this.theta);

    const fx = this.x + cosT * this.wheelBase - sinT * this.axleOffsetY;
    const fy = this.y + sinT * this.wheelBase + cosT * this.axleOffsetY;

    const rx = this.x - cosT * this.wheelBase - sinT * this.axleOffsetY;
    const ry = this.y - sinT * this.wheelBase + cosT * this.axleOffsetY;

    const fGroundY = getY(fx);
    const rGroundY = getY(rx);

    const fHasGround = fGroundY > -45;
    const rHasGround = rGroundY > -45;

    const fTargetY = fGroundY + this.wheelRadius;
    const rTargetY = rGroundY + this.wheelRadius;

    const fDist = fHasGround ? fy - fTargetY : 99;
    const rDist = rHasGround ? ry - rTargetY : 99;

    this.frontWheelGrounded = fHasGround && fDist <= 0.14;
    this.rearWheelGrounded = rHasGround && rDist <= 0.14;
    const isAnyWheelGrounded = this.frontWheelGrounded || this.rearWheelGrounded;

    this.frontSuspensionY = fHasGround ? Math.max(-0.26, Math.min(0.22, -fDist * 0.4)) : -0.14;
    this.rearSuspensionY = rHasGround ? Math.max(-0.26, Math.min(0.22, -rDist * 0.4)) : -0.14;

    // 3. Gravity
    const prevVy = this.vy;
    this.vy -= this.gravity * delta;

    // 4. Drive Forces & Slope Resistance
    const activeSlope = rHasGround && fHasGround
      ? (getSlope(fx) + getSlope(rx)) * 0.5
      : rHasGround
      ? getSlope(rx)
      : fHasGround
      ? getSlope(fx)
      : 0;
    const slopeAngle = Math.atan(activeSlope);

    if (isAnyWheelGrounded) {
      if (this.state.fuel > 0 && (input.gas || input.brake)) {
        let driveForce = 0;
        if (input.gas && !input.brake) {
          driveForce = 28.5 + Math.min(11, this.level.id * 0.95);
        } else if (input.brake && !input.gas) {
          driveForce = this.vx > 0.8 ? -34.0 : -17.5;
        }

        const slopePullBack = Math.sin(slopeAngle) * 11.0;
        const netForward = driveForce - slopePullBack;

        this.vx += Math.cos(slopeAngle) * netForward * delta;
        this.vy += Math.sin(slopeAngle) * netForward * delta * 0.45;
        this.vx *= Math.pow(0.76, delta);
      } else {
        const slopePullBack = Math.sin(slopeAngle) * 11.0;
        if (Math.abs(slopeAngle) >= 0.1 || Math.abs(this.vx) >= 0.12) {
          this.vx -= Math.cos(slopeAngle) * slopePullBack * delta;
          this.vx *= Math.pow(0.28, delta);
        }
        if (!input.gas && !input.brake && Math.abs(this.vx) < 0.08 && Math.abs(slopeAngle) < 0.1) {
          this.vx = 0;
        }
      }

      // Ramp launch vertical velocity transfer: riding up a ramp at speed carries real upward momentum!
      if (this.vx > 3.5 && activeSlope > 0.12) {
        const geometricRampVy = this.vx * activeSlope;
        if (this.vy < geometricRampVy) {
          this.vy = this.vy + (geometricRampVy - this.vy) * Math.min(1, 18 * delta);
        }
      }
    } else {
      // Natural angular kick when first launching off a curved ramp lip at speed
      if (this.wasGrounded && this.vx > 8.0 && this.prevSlope > 0.18) {
        const slopeDrop = Math.max(0, this.prevSlope - activeSlope);
        this.omega += Math.min(1.6, (this.prevSlope * 0.45 + slopeDrop * 0.8) * (this.vx / 22));
      }

      // Responsive mid-air flip controls (GAS = Backflip, BRAKE = Frontflip)
      const airControlAuthority = Math.min(1, this.airTime / 0.10);
      const airTorque = (7.4 + this.level.id * 0.12) * airControlAuthority;
      if (input.gas && !input.brake) {
        this.omega += airTorque * delta;
      }
      if (input.brake && !input.gas) {
        this.omega -= airTorque * 1.15 * delta;
      }

      // Gentle aerodynamic stabilization only on tiny hops when neither pedal is held
      if (!input.gas && !input.brake && this.airTime < 0.55) {
        const normT = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
        if (Math.abs(normT) < 0.85) {
          this.omega += -normT * 1.9 * delta;
        }
      }

      this.vx *= Math.pow(0.91, delta);
      const airAngDamp = input.gas || input.brake ? Math.pow(0.78, delta) : Math.pow(0.35, delta);
      this.omega = Math.max(-6.8, Math.min(6.8, this.omega * airAngDamp));
    }

    const levelMaxSpeed = this.maxForwardSpeed + this.level.id * 0.7;
    this.vx = Math.max(this.maxReverseSpeed, Math.min(levelMaxSpeed, this.vx));

    // 5. Suspension Spring Forces
    const springK = 92;
    const damperD = 14;

    if (fHasGround && fDist < 0) {
      const fSpring = -fDist * springK - this.vy * damperD;
      this.vy += Math.max(0, fSpring) * delta;
      this.y += Math.max(0, -fDist) * 0.45;
    }

    if (rHasGround && rDist < 0) {
      const rSpring = -rDist * springK - this.vy * damperD;
      this.vy += Math.max(0, rSpring) * delta;
      this.y += Math.max(0, -rDist) * 0.45;
    }

    // 6. Slope Tracking, Natural Hill-Climb Tilt & Launch Preservation
    const normalizedTheta = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
    if (fHasGround && rHasGround && isAnyWheelGrounded) {
      if (Math.abs(normalizedTheta) < 1.95) {
        const targetSlopeAngle = Math.atan2(fGroundY - rGroundY, Math.max(0.5, fx - rx));
        // Subtle lifelike suspension squat / tilt when climbing hills under GAS or diving under BRAKE
        let climbTilt = 0;
        if (this.frontWheelGrounded && this.rearWheelGrounded) {
          if (input.gas && this.vx > 1.0) {
            climbTilt = Math.min(0.18, 0.05 + Math.max(0, slopeAngle) * 0.16);
          } else if (input.brake && Math.abs(this.vx) > 1.0) {
            climbTilt = -0.05;
          }
        }
        let angleDiff = targetSlopeAngle + climbTilt - normalizedTheta;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (this.frontWheelGrounded && this.rearWheelGrounded) {
          const alignSpeed = Math.max(10.0, 15.5 - this.level.id * 0.35);
          this.theta += angleDiff * Math.min(1.0, alignSpeed * delta);
          this.omega *= Math.pow(0.02, delta);
        } else {
          // One wheel grounded: gravity pulls airborne axle down, while rough landings can recover
          const restoreRate = this.rearWheelGrounded ? 10.2 : 11.5;
          this.omega += angleDiff * restoreRate * delta;
          if (this.rearWheelGrounded && input.gas && angleDiff < 0.35) {
            this.omega += 0.85 * delta;
          }
          this.omega *= Math.pow(0.08, delta);
          this.theta += this.omega * delta;
        }
      } else {
        this.theta += this.omega * delta;
      }
    } else if (isAnyWheelGrounded && !(fHasGround && rHasGround)) {
      this.theta += (slopeAngle - normalizedTheta) * Math.min(1, 6 * delta);
      this.omega *= Math.pow(0.25, delta);
    } else {
      this.theta += this.omega * delta;
    }

    this.prevSlope = activeSlope;
    this.wasGrounded = isAnyWheelGrounded;

    // 7. Normal Obstacle Collisions (slowdown, bounce & tilt kick — NO instant Game Over)
    for (const obs of obstacles) {
      if (obs.hitCooldown > 0) continue;
      const dx = this.x - obs.x;
      const dy = this.y - obs.y;
      const hitRadius = obs.radius + 1.15;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        obs.hitCooldown = 0.85;
        const impactSpeed = Math.hypot(this.vx, this.vy);

        // Normal obstacles knock speed down, bounce suspension, and tilt the chassis
        const wear = Math.round(6 + Math.min(12, impactSpeed * 0.4));
        this.state.health = Math.max(15, this.state.health - wear);

        this.vx *= 0.44;
        this.vy = Math.max(this.vy, 5.2);
        this.omega += (dx <= 0 ? 1 : -1) * (2.1 + Math.min(1.8, impactSpeed * 0.06));
        sound.playLandingThud(1.2);
        onObstacleHit();
        break;
      }
    }

    // Integrate position
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    // Ground clamp ONLY when solid ground exists directly beneath center (never kill safe/rough wheel landings!)
    const groundUnderCenter = getY(this.x);
    if (groundUnderCenter > -45) {
      this.lastSafeGroundY = groundUnderCenter;
      if (this.y < groundUnderCenter + this.wheelRadius + 0.12) {
        const slamTheta = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
        let angleOffRoad = Math.abs(slamTheta - slopeAngle);
        while (angleOffRoad > Math.PI) angleOffRoad = Math.abs(angleOffRoad - Math.PI * 2);

        // Serious Crash ONLY on high-force vertical/inverted ground slams (> ~92 deg off road & hard impact)
        if (prevVy < -14.2 && angleOffRoad > 1.6) {
          this.state.health = 0;
          this.triggerGameOver('Serious Crash!', 'crash');
          return;
        }

        // Safe or rough 4-wheel landings recover naturally
        this.y = groundUnderCenter + this.wheelRadius + 0.12;
        if (this.vy < 0) this.vy = 0;
      }
    }

    // Update telemetry
    this.state.distance = Math.max(this.state.distance, Math.min(this.level.length, Math.round(this.x)));
    this.state.speed = this.vx;
    this.state.inAir = !isAnyWheelGrounded;
    this.state.flips = this.flips;

    // 8. Deep Pit & Outside Playable Road Bounds Checks
    if ((groundUnderCenter <= -45 && this.y < this.lastSafeGroundY - 7.0) || this.y < -34) {
      this.triggerGameOver('Fell into a Deep Pit!', 'gap');
      return;
    }
    if (this.x < -22 || this.y > 95 || this.y < -42) {
      this.triggerGameOver('Outside Playable Road!', 'crash');
      return;
    }

    // 9. Air Time & Stunt Flips (Frontflips & Backflips)
    if (this.state.inAir) {
      this.airTime += delta;
      this.rotationAccumulator += this.omega * delta;

      if (this.rotationAccumulator > Math.PI * 1.75) {
        this.flips++;
        this.rotationAccumulator -= Math.PI * 2;
        this.state.score += 500;
        onStunt('BACKFLIP! +500', 500);
      } else if (this.rotationAccumulator < -Math.PI * 1.75) {
        this.flips++;
        this.rotationAccumulator += Math.PI * 2;
        this.state.score += 500;
        onStunt('FRONTFLIP! +500', 500);
      }
    } else {
      if (this.airTime > 0.95) {
        const bonus = Math.round(this.airTime * 150);
        this.state.score += bonus;
        onStunt(`BIG AIR! +${bonus}`, bonus);
        sound.playLandingThud(this.airTime);
      }
      this.airTime = 0;
      this.rotationAccumulator = 0;
    }

    // 10. Upside-Down Roof Landing & Unstable Rollover Detection
    const postTheta = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
    const isUpsideDown = Math.abs(postTheta) > 1.74; // > ~100 deg
    if (isUpsideDown) {
      const roofX = this.x - sinT * 1.65;
      const roofY = this.y + cosT * 1.65;
      const roofGround = getY(roofX);

      // Driver/roof hits the ground with impact force -> fatal roof crash
      if (roofGround > -45 && roofY <= roofGround + 0.52 && (prevVy < -3.5 || Math.abs(this.omega) > 1.6 || Math.abs(this.vx) > 3.0)) {
        this.state.health = 0;
        this.triggerGameOver('Driver Down! Roof Crash!', 'crash');
        return;
      }

      // Resting/pinned upside down unable to recover for 1.8 seconds -> Game Over
      this.invertedStuckTimer += delta;
      if (this.invertedStuckTimer >= 1.8) {
        this.state.health = 0;
        this.triggerGameOver('Flipped Upside Down!', 'crash');
        return;
      }
    } else {
      this.invertedStuckTimer = 0;
    }

    // 11. Level Completion Check (Strictly stops current level at finish line)
    if (this.x >= this.level.length) {
      this.x = this.level.length;
      this.vx = 0;
      this.vy = 0;
      this.omega = 0;
      this.state.speed = 0;
      this.state.isLevelComplete = true;
      this.state.distance = this.level.length;

      const coinRatio = this.state.coinsCollected / this.totalLevelCoins;
      let stars = 1;
      if (coinRatio >= 0.3 || this.flips >= 1) stars = 2;
      if (coinRatio >= 0.55 || (coinRatio >= 0.35 && this.flips >= 1)) stars = 3;

      this.state.starsEarned = stars;
      this.state.bonusReward = this.level.bonusCoins + stars * 150;
      sound.updateEngine(0, false);
      sound.playLevelCompleteApplause();
      return;
    }

    // Sound engine update
    const speedRatio = Math.abs(this.vx) / 22;
    sound.updateEngine(speedRatio, isAccelerating);
  }
}
