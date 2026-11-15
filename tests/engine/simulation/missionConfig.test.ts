/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mission Configuration & Requirements Engine Unit Tests (Phase 3 Module 3)
 */

import { describe, expect, it } from "bun:test";
import {
  ALL_MISSION_DESTINATION_IDS,
  DESTINATION_PRESETS,
  GROUND_STATION_PRESETS,
  WFF,
  SG3,
  GDS,
  DEFAULT_SCIENCE_REQUIREMENTS,
  getDestinationProfile,
  assertSupportedDestination,
  validateKeplerianElements,
  validateGroundStation,
  validateMissionScienceRequirements,
  validateSpacecraftDesignInput,
  validateMissionConfiguration,
  createMissionConfiguration,
  KeplerianElements,
  GroundStationLocation,
  MissionScienceRequirements,
  SpacecraftDesignInput,
  LaunchServicePolicy,
  MissionConfiguration,
  MissionDestinationId,
} from "../../../src/engine/simulation/missionConfig";

import {
  kilometers,
  meters,
  degrees,
  radians,
  julianDate,
  megabits,
  kg,
  watts,
  wattHours,
  hertz,
  dB,
  dBi,
  seconds,
  ValidationError,
  EARTH_EQUATORIAL_RADIUS_KM,
  DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT,
  DEFAULT_LINK_MARGIN_THRESHOLD_DB,
  MAX_PERMITTED_ECCENTRICITY,
} from "../../../src/engine/simulation/simUnits";

import { DEFAULT_EPOCH_JULIAN_DATE } from "../../../src/engine/simulation/missionLifecycle";

describe("Phase 3 Module 3: Mission Configuration & Requirements Engine (missionConfig.ts)", () => {
  // ==========================================================================
  // 1. Destination Presets & Geocentric Scope Boundary
  // ==========================================================================
  describe("Destination Presets & Geocentric Scope Boundary", () => {
    it("defines all 6 standard destination presets with correct metadata", () => {
      expect(ALL_MISSION_DESTINATION_IDS.length).toBe(6);

      for (const destId of ALL_MISSION_DESTINATION_IDS) {
        const profile = getDestinationProfile(destId);
        expect(profile).toBeDefined();
        expect(profile.id).toBe(destId);
        expect(profile.name.length > 0).toBeTrue();
        expect(["EARTH", "MOON", "MARS"]).toContain(profile.centralBody);
        expect(Object.isFrozen(profile)).toBeTrue();
        expect(Object.isFrozen(profile.nominalElements)).toBeTrue();
      }
    });

    it("identifies supported Earth destinations versus unsupported Phase 4 destinations", () => {
      // Supported in Phase 3
      expect(DESTINATION_PRESETS.LEO_SSO_600KM.isSupportedInPhase3).toBeTrue();
      expect(DESTINATION_PRESETS.LEO_ISS_400KM.isSupportedInPhase3).toBeTrue();
      expect(DESTINATION_PRESETS.POLAR_700KM.isSupportedInPhase3).toBeTrue();
      expect(DESTINATION_PRESETS.GEO_STATIONARY.isSupportedInPhase3).toBeTrue();

      // Unsupported in Phase 3 (Reserved for Phase 4 Multi-Body Expansion)
      expect(DESTINATION_PRESETS.LUNAR_RELAY_100KM.isSupportedInPhase3).toBeFalse();
      expect(DESTINATION_PRESETS.LUNAR_RELAY_100KM.centralBody).toBe("MOON");
      expect(DESTINATION_PRESETS.MARS_TRANSFER.isSupportedInPhase3).toBeFalse();
      expect(DESTINATION_PRESETS.MARS_TRANSFER.centralBody).toBe("MARS");
    });

    it("assertSupportedDestination passes for Earth orbits and throws for non-geocentric destinations", () => {
      expect(() => assertSupportedDestination("LEO_SSO_600KM")).not.toThrow();
      expect(() => assertSupportedDestination("LEO_ISS_400KM")).not.toThrow();
      expect(() => assertSupportedDestination("POLAR_700KM")).not.toThrow();
      expect(() => assertSupportedDestination("GEO_STATIONARY")).not.toThrow();

      // Lunar Relay must throw descriptive ValidationError citing Phase 4
      expect(() => assertSupportedDestination("LUNAR_RELAY_100KM")).toThrow(ValidationError);
      try {
        assertSupportedDestination("LUNAR_RELAY_100KM");
      } catch (err) {
        expect((err as ValidationError).message).toContain("Phase 4 Multi-Body Expansion");
        expect((err as ValidationError).message).toContain("MOON");
      }

      // Mars Transfer must throw descriptive ValidationError citing Phase 4
      expect(() => assertSupportedDestination("MARS_TRANSFER")).toThrow(ValidationError);
      try {
        assertSupportedDestination("MARS_TRANSFER");
      } catch (err) {
        expect((err as ValidationError).message).toContain("Phase 4 Multi-Body Expansion");
        expect((err as ValidationError).message).toContain("MARS");
      }
    });

    it("throws ValidationError for unrecognized destination ID", () => {
      expect(() => getDestinationProfile("INVALID_DESTINATION" as MissionDestinationId)).toThrow(ValidationError);
      expect(() => assertSupportedDestination("UNKNOWN_TARGET" as MissionDestinationId)).toThrow(ValidationError);
    });

    it("verifies analytical baseline parameters for Case S-1 (LEO_SSO_600KM)", () => {
      const sso = DESTINATION_PRESETS.LEO_SSO_600KM;
      expect(sso.nominalElements.semiMajorAxisKm).toBeCloseTo(6978.137, 3);
      expect(sso.nominalElements.eccentricity).toBe(0.001);
      expect(sso.nominalElements.inclinationDeg).toBe(97.79);
      expect(sso.nominalElements.raanDeg).toBe(45.0);
      expect(sso.provenance).toBe("VERIFIED");
    });
  });

  // ==========================================================================
  // 2. Ground Station Network Locations & Presets
  // ==========================================================================
  describe("Ground Station Network Presets & Validation", () => {
    it("exports verified ground station presets matching specification §5.3", () => {
      // Registry contains exactly three canonical stations
      const stationKeys = Object.keys(GROUND_STATION_PRESETS);
      expect(stationKeys.length).toBe(3);
      expect(stationKeys).toContain("NASA_WALLOPS_WFF");
      expect(stationKeys).toContain("SVALBARD_SG3");
      expect(stationKeys).toContain("NASA_DSN_GOLDSTONE");

      // Each canonical station ID appears once
      const stationValues = Object.values(GROUND_STATION_PRESETS);
      expect(stationValues.length).toBe(3);
      const uniqueIds = new Set(stationValues.map((s) => s.id));
      expect(uniqueIds.size).toBe(3);

      // NASA Wallops Flight Facility (WFF)
      const wff = GROUND_STATION_PRESETS.NASA_WALLOPS_WFF;
      expect(wff.latitudeDeg).toBeCloseTo(37.9402, 4);
      expect(wff.longitudeDeg).toBeCloseTo(-75.4664, 4);
      expect(wff.altitudeMeters).toBe(10.0);
      expect(wff.minimumElevationMaskDeg).toBe(10.0);
      expect(wff.provenance).toBe("VERIFIED");

      // Svalbard Satellite Station (SG3)
      const sg3 = GROUND_STATION_PRESETS.SVALBARD_SG3;
      expect(sg3.latitudeDeg).toBeCloseTo(78.2298, 4);
      expect(sg3.longitudeDeg).toBeCloseTo(15.4078, 4);
      expect(sg3.altitudeMeters).toBe(450.0);
      expect(sg3.minimumElevationMaskDeg).toBe(10.0);
      expect(sg3.provenance).toBe("VERIFIED");

      // NASA DSN Goldstone (GDS)
      const gds = GROUND_STATION_PRESETS.NASA_DSN_GOLDSTONE;
      expect(gds.latitudeDeg).toBeCloseTo(35.4267, 4);
      expect(gds.longitudeDeg).toBeCloseTo(-116.89, 4);
      expect(gds.altitudeMeters).toBe(1000.0);
      expect(gds.minimumElevationMaskDeg).toBe(10.0);
      expect(gds.provenance).toBe("VERIFIED");

      // Separate alias references point to the exact canonical preset objects
      expect(WFF).toBe(wff);
      expect(SG3).toBe(sg3);
      expect(GDS).toBe(gds);
      expect(WFF.id).toBe(wff.id);
      expect(SG3.id).toBe(sg3.id);
      expect(GDS.id).toBe(gds.id);
    });

    it("accepts all canonical presets in mission configuration without duplicate-ID errors", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_ALL_GS",
          missionName: "All Ground Stations Mission",
          groundStations: Object.values(GROUND_STATION_PRESETS),
        })
      ).not.toThrow();
    });

    it("validates valid custom ground station location without error", () => {
      const customStation: GroundStationLocation = {
        id: "CANBERRA_CDS",
        name: "NASA DSN Canberra Deep Space Communication Complex",
        latitudeDeg: degrees(-35.4014),
        longitudeDeg: degrees(148.9817),
        altitudeMeters: meters(650.0),
        minimumElevationMaskDeg: degrees(10.0),
      };

      expect(() => validateGroundStation(customStation)).not.toThrow();
    });

    it("rejects ground station with empty id or name", () => {
      const badId: GroundStationLocation = {
        ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
        id: "   ",
      };
      expect(() => validateGroundStation(badId)).toThrow(ValidationError);

      const badName: GroundStationLocation = {
        ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
        name: "",
      };
      expect(() => validateGroundStation(badName)).toThrow(ValidationError);
    });

    it("rejects invalid latitude out of [-90, +90] deg range", () => {
      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          latitudeDeg: degrees(95.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          latitudeDeg: degrees(-90.1),
        })
      ).toThrow(ValidationError);
    });

    it("rejects invalid longitude out of [-180, +180] deg range", () => {
      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          longitudeDeg: degrees(181.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          longitudeDeg: degrees(-185.0),
        })
      ).toThrow(ValidationError);
    });

    it("rejects out-of-range elevation mask or altitude", () => {
      // Elevation mask > 90 deg or < 0 deg
      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          minimumElevationMaskDeg: degrees(95.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          minimumElevationMaskDeg: degrees(-5.0),
        })
      ).toThrow(ValidationError);

      // Altitude < -500 m or absurdly high
      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          altitudeMeters: meters(-600.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateGroundStation({
          ...GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
          altitudeMeters: meters(100000.0),
        })
      ).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 3. Keplerian Orbital Elements Validation
  // ==========================================================================
  describe("Keplerian Orbital Elements Validation", () => {
    const nominalElements: KeplerianElements = {
      semiMajorAxisKm: kilometers(6978.137), // 600 km circular LEO
      eccentricity: 0.001,
      inclinationDeg: degrees(97.79),
      raanDeg: degrees(45.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    };

    it("validates nominal Keplerian orbital elements without error", () => {
      expect(() => validateKeplerianElements(nominalElements)).not.toThrow();
    });

    it("rejects subterranean perigee where trajectory intersects Earth surface", () => {
      // a = 6000 km, e = 0.0 -> perigee radius = 6000 km < 6378.137 km (below surface)
      const subterraneanElements: KeplerianElements = {
        ...nominalElements,
        semiMajorAxisKm: kilometers(6000.0),
        eccentricity: 0.0,
      };
      expect(() => validateKeplerianElements(subterraneanElements)).toThrow(ValidationError);

      // a = 8000 km, e = 0.3 -> perigee = 8000 * (1 - 0.3) = 5600 km < 6378.137 km
      const ellipticalSubterranean: KeplerianElements = {
        ...nominalElements,
        semiMajorAxisKm: kilometers(8000.0),
        eccentricity: 0.3,
      };
      expect(() => validateKeplerianElements(ellipticalSubterranean)).toThrow(ValidationError);
    });

    it("enforces eccentricity numerical bounds [0.0, 0.85]", () => {
      // Negative eccentricity
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          eccentricity: -0.01,
        })
      ).toThrow(ValidationError);

      // Eccentricity exceeding MAX_PERMITTED_ECCENTRICITY (0.85)
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          semiMajorAxisKm: kilometers(50000.0), // perigee = 50000 * 0.14 = 7000 km > 6378 km
          eccentricity: 0.86,
        })
      ).toThrow(ValidationError);

      // Upper bound 0.85 is accepted if perigee is above surface
      // a = 50000 km, e = 0.85 -> perigee = 50000 * 0.15 = 7500 km > 6378 km
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          semiMajorAxisKm: kilometers(50000.0),
          eccentricity: 0.85,
        })
      ).not.toThrow();
    });

    it("enforces inclination within [0.0, 180.0] deg", () => {
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          inclinationDeg: degrees(-1.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          inclinationDeg: degrees(180.1),
        })
      ).toThrow(ValidationError);

      // Exactly 0 deg (equatorial) and 180 deg (equatorial retrograde) pass
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          inclinationDeg: degrees(0.0),
        })
      ).not.toThrow();

      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          inclinationDeg: degrees(180.0),
        })
      ).not.toThrow();
    });

    it("enforces angular parameters within [0.0, 360.0] deg", () => {
      // RAAN
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          raanDeg: degrees(-5.0),
        })
      ).toThrow(ValidationError);
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          raanDeg: degrees(365.0),
        })
      ).toThrow(ValidationError);

      // Argument of Periapsis
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          argOfPeriapsisDeg: degrees(361.0),
        })
      ).toThrow(ValidationError);

      // Mean Anomaly at Epoch
      expect(() =>
        validateKeplerianElements({
          ...nominalElements,
          meanAnomalyAtEpochDeg: degrees(-0.1),
        })
      ).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 4. Mission Science Requirements Validation
  // ==========================================================================
  describe("Mission Science Requirements Validation", () => {
    it("validates DEFAULT_SCIENCE_REQUIREMENTS baseline", () => {
      expect(DEFAULT_SCIENCE_REQUIREMENTS.primaryScienceGoal.length > 0).toBeTrue();
      expect(DEFAULT_SCIENCE_REQUIREMENTS.requiredDataVolumeMbits).toBe(1000.0);
      expect(DEFAULT_SCIENCE_REQUIREMENTS.targetLifetimeDays).toBe(30);
      expect(DEFAULT_SCIENCE_REQUIREMENTS.minimumOperationalOrbits).toBe(15);
      expect(DEFAULT_SCIENCE_REQUIREMENTS.maxAllowedBatteryDodPercent).toBe(20.0);
      expect(DEFAULT_SCIENCE_REQUIREMENTS.requiredCmlDryMassMarginPercent).toBe(
        DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT
      );
      expect(DEFAULT_SCIENCE_REQUIREMENTS.requiredLinkMarginDb).toBe(
        DEFAULT_LINK_MARGIN_THRESHOLD_DB
      );
      expect(Object.isFrozen(DEFAULT_SCIENCE_REQUIREMENTS)).toBeTrue();

      expect(() => validateMissionScienceRequirements(DEFAULT_SCIENCE_REQUIREMENTS)).not.toThrow();
    });

    it("rejects empty primary science goal", () => {
      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          primaryScienceGoal: "   ",
        })
      ).toThrow(ValidationError);
    });

    it("rejects non-positive required data volume or lifetime", () => {
      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          requiredDataVolumeMbits: megabits(0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          requiredDataVolumeMbits: megabits(-100),
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          targetLifetimeDays: 0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects invalid minimum operational orbits or DoD limits", () => {
      // Orbits must be integer >= 1
      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          minimumOperationalOrbits: 0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          minimumOperationalOrbits: 2.5,
        })
      ).toThrow(ValidationError);

      // Max DoD must be in (0, 100]%
      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          maxAllowedBatteryDodPercent: 0.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateMissionScienceRequirements({
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          maxAllowedBatteryDodPercent: 105.0,
        })
      ).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 5. Spacecraft Design Reference & Standards Integration
  // ==========================================================================
  describe("Spacecraft Design Reference & Standards Integration", () => {
    const nominalSpacecraft: SpacecraftDesignInput = {
      spacecraftId: "SC_LEO_3U_001",
      spacecraftName: "EarthObserver-3U",
      formFactor: "3U",
      dryMassKg: kg(3.5),
      propellantMassKg: kg(0.0),
      batteryCapacityWh: wattHours(30.0),
      nominalBusPowerW: watts(4.0),
      safeModePowerW: watts(2.0),
      payloadPowerW: watts(10.0),
      solarCellAreaM2: 0.03,
      solarCellEfficiency: 0.28,
      txPowerWatts: watts(2.0),
      txFrequencyHz: hertz(2.2e9),
      dataRateBps: 1000000,
      cdsRevision: "CDS_REV_14_1",
      dispenserProfileId: "PPOD_MK3_3U",
    };

    it("validates nominal 3U spacecraft design matching Case S-1 baseline", () => {
      expect(() => validateSpacecraftDesignInput(nominalSpacecraft)).not.toThrow();
    });

    it("enforces CDS standard form-factor compatibility", () => {
      // 6U is valid under CDS Rev 14.1
      expect(() =>
        validateSpacecraftDesignInput({
          ...nominalSpacecraft,
          formFactor: "6U",
          dryMassKg: kg(10.0),
          cdsRevision: "CDS_REV_14_1",
          dispenserProfileId: undefined,
        })
      ).not.toThrow();

      // 6U was NOT standardized in CDS Rev 13 -> must throw ValidationError
      expect(() =>
        validateSpacecraftDesignInput({
          ...nominalSpacecraft,
          formFactor: "6U",
          cdsRevision: "CDS_REV_13",
          dispenserProfileId: undefined,
        })
      ).toThrow(ValidationError);
    });

    it("enforces dispenser structural rated payload mass limits", () => {
      // P-POD Mk III rated payload mass limit is 4.00 kg.
      // Dry mass 3.8 kg + propellant 0.5 kg = 4.3 kg > 4.00 kg -> must throw ValidationError
      expect(() =>
        validateSpacecraftDesignInput({
          ...nominalSpacecraft,
          dryMassKg: kg(3.8),
          propellantMassKg: kg(0.5),
          dispenserProfileId: "PPOD_MK3_3U",
        })
      ).toThrow(ValidationError);
    });

    describe("NASA LSP-REQ-317.01 Rev B §6.2.5 Launch Policy Propulsion Enforcement", () => {
      // Base valid 3U configuration with P-POD Mk III and 0.5 kg propellant (total wet mass = 3.5 kg <= 4.00 kg limit)
      const basePropelledCubeSat: SpacecraftDesignInput = {
        ...nominalSpacecraft,
        dryMassKg: kg(3.0),
        propellantMassKg: kg(0.5),
        dispenserProfileId: "PPOD_MK3_3U",
      };

      it("1. rejects P-POD Mk III + NASA_CSLI + positive propellant mass", () => {
        const csliPropelled: SpacecraftDesignInput = {
          ...basePropelledCubeSat,
          launchServicePolicy: "NASA_CSLI",
        };

        expect(() => validateSpacecraftDesignInput(csliPropelled)).toThrow(ValidationError);
        try {
          validateSpacecraftDesignInput(csliPropelled);
        } catch (err) {
          expect((err as ValidationError).message).toContain("LSP-REQ-317.01 Rev B §6.2.5");
          expect((err as ValidationError).message).toContain("Propulsion systems are prohibited");
        }
      });

      it("2. accepts P-POD Mk III + COMMERCIAL + positive propellant mass", () => {
        const commercialPropelled: SpacecraftDesignInput = {
          ...basePropelledCubeSat,
          launchServicePolicy: "COMMERCIAL",
        };

        expect(() => validateSpacecraftDesignInput(commercialPropelled)).not.toThrow();
      });

      it("3. accepts P-POD Mk III + CUSTOM + positive propellant mass", () => {
        const customPolicyPropelled: SpacecraftDesignInput = {
          ...basePropelledCubeSat,
          launchServicePolicy: "CUSTOM",
        };

        expect(() => validateSpacecraftDesignInput(customPolicyPropelled)).not.toThrow();
      });

      it("4. accepts P-POD Mk III + omitted launch policy + positive propellant mass", () => {
        const unconstrainedPropelled: SpacecraftDesignInput = {
          ...basePropelledCubeSat,
          launchServicePolicy: undefined,
        };

        expect(() => validateSpacecraftDesignInput(unconstrainedPropelled)).not.toThrow();
      });

      it("5. accepts NASA_CSLI + zero propellant mass in P-POD Mk III", () => {
        const csliUnpropelled: SpacecraftDesignInput = {
          ...nominalSpacecraft,
          dryMassKg: kg(3.5),
          propellantMassKg: kg(0.0),
          dispenserProfileId: "PPOD_MK3_3U",
          launchServicePolicy: "NASA_CSLI",
        };

        expect(() => validateSpacecraftDesignInput(csliUnpropelled)).not.toThrow();
      });
    });

    it("rejects invalid solar efficiency or negative bus power", () => {
      expect(() =>
        validateSpacecraftDesignInput({
          ...nominalSpacecraft,
          solarCellEfficiency: 1.5, // > 1.0 is impossible
        })
      ).toThrow(ValidationError);

      expect(() =>
        validateSpacecraftDesignInput({
          ...nominalSpacecraft,
          nominalBusPowerW: watts(0.0),
        })
      ).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 6. Complete Mission Configuration Creation & Immutability
  // ==========================================================================
  describe("Mission Configuration Construction & Immutability", () => {
    it("creates nominal mission configuration with default parameters", () => {
      const config = createMissionConfiguration({
        missionId: "MISSION_LEO_001",
        missionName: "SSO Earth Observer Mission",
      });

      expect(config.missionId).toBe("MISSION_LEO_001");
      expect(config.missionName).toBe("SSO Earth Observer Mission");
      expect(config.destinationId).toBe("LEO_SSO_600KM");
      expect(config.initialOrbitalElements.semiMajorAxisKm).toBeCloseTo(6978.137, 3);
      expect(config.groundStations.length).toBe(2);
      expect(config.groundStations[0].id).toBe("SVALBARD_SG3");
      expect(config.groundStations[1].id).toBe("NASA_WALLOPS_WFF");
      expect(config.epochJulianDate).toBe(DEFAULT_EPOCH_JULIAN_DATE);
      expect(config.scienceRequirements.primaryScienceGoal).toBe(
        DEFAULT_SCIENCE_REQUIREMENTS.primaryScienceGoal
      );

      // Verify deep immutability
      expect(Object.isFrozen(config)).toBeTrue();
      expect(Object.isFrozen(config.initialOrbitalElements)).toBeTrue();
      expect(Object.isFrozen(config.groundStations)).toBeTrue();
      expect(Object.isFrozen(config.scienceRequirements)).toBeTrue();
    });

    it("accepts custom orbital elements, custom ground stations, and custom epoch", () => {
      const customElements: KeplerianElements = {
        semiMajorAxisKm: kilometers(6778.137), // 400 km ISS orbit
        eccentricity: 0.0005,
        inclinationDeg: degrees(51.64),
        raanDeg: degrees(120.0),
        argOfPeriapsisDeg: degrees(45.0),
        meanAnomalyAtEpochDeg: degrees(10.0),
      };

      const customEpoch = julianDate(2460000.5);

      const config = createMissionConfiguration({
        missionId: "MISSION_ISS_002",
        missionName: "ISS Co-Orbital Demonstration",
        destinationId: "LEO_ISS_400KM",
        initialOrbitalElements: customElements,
        groundStations: [GROUND_STATION_PRESETS.NASA_DSN_GOLDSTONE],
        epochJulianDate: customEpoch,
      });

      expect(config.destinationId).toBe("LEO_ISS_400KM");
      expect(config.initialOrbitalElements.semiMajorAxisKm).toBe(customElements.semiMajorAxisKm);
      expect(config.initialOrbitalElements.inclinationDeg).toBe(51.64);
      expect(config.groundStations.length).toBe(1);
      expect(config.groundStations[0].id).toBe("NASA_DSN_GOLDSTONE");
      expect(config.epochJulianDate).toBe(customEpoch);
    });

    it("rejects configuration without any ground stations", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_NO_GS",
          missionName: "No Ground Station Mission",
          groundStations: [],
        })
      ).toThrow(ValidationError);
    });

    it("rejects configuration with duplicate ground station IDs", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_DUP_GS",
          missionName: "Duplicate Ground Station Mission",
          groundStations: [
            GROUND_STATION_PRESETS.SVALBARD_SG3,
            GROUND_STATION_PRESETS.SVALBARD_SG3, // Duplicate!
          ],
        })
      ).toThrow(ValidationError);
    });

    it("rejects configuration with unsupported non-geocentric destination", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_LUNAR",
          missionName: "Lunar Gateway Relay",
          destinationId: "LUNAR_RELAY_100KM",
        })
      ).toThrow(ValidationError);
    });

    it("rejects configuration with missing or blank mission ID or name", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "   ",
          missionName: "Valid Name",
        })
      ).toThrow(ValidationError);

      expect(() =>
        createMissionConfiguration({
          missionId: "VALID_ID",
          missionName: "",
        })
      ).toThrow(ValidationError);
    });

    it("rejects configuration with invalid non-positive epoch Julian Date", () => {
      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_BAD_EPOCH",
          missionName: "Bad Epoch Mission",
          epochJulianDate: julianDate(0.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createMissionConfiguration({
          missionId: "MISSION_BAD_EPOCH",
          missionName: "Bad Epoch Mission",
          epochJulianDate: julianDate(-2451545.0),
        })
      ).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 7. Determinism & Cross-Module Consistency
  // ==========================================================================
  describe("Determinism & Cross-Module Consistency", () => {
    it("produces deterministic validation outcomes across repeated runs", () => {
      const configA = createMissionConfiguration({
        missionId: "DET_001",
        missionName: "Deterministic Check",
      });

      const configB = createMissionConfiguration({
        missionId: "DET_001",
        missionName: "Deterministic Check",
      });

      expect(configA.missionId).toBe(configB.missionId);
      expect(configA.destinationId).toBe(configB.destinationId);
      expect(configA.initialOrbitalElements.semiMajorAxisKm).toBe(
        configB.initialOrbitalElements.semiMajorAxisKm
      );
      expect(configA.epochJulianDate).toBe(configB.epochJulianDate);
    });
  });
});
