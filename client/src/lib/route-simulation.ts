export const DEFAULT_SIMULATION_SPEED_KMH = 30;
export const STOP_DWELL_SECONDS = 5;

export type SimulationStatus = "running" | "paused" | "at-stop" | "completed";
export type SimulationRuntime = {
  travelledMeters: number;
  currentStopIndex: number;
  dwellRemainingSeconds: number;
  status: SimulationStatus;
  pausedFromStatus?: "running" | "at-stop";
  speedKmh: number;
};

export function simulationAtElapsed(stopDistancesMeters: number[], totalDistanceMeters: number, elapsedSeconds: number, speedKmh = DEFAULT_SIMULATION_SPEED_KMH): SimulationRuntime {
  let remaining = Math.max(0, elapsedSeconds);
  let travelledMeters = 0;
  let currentStopIndex = 0;
  let dwellRemainingSeconds = 0;
  const metersPerSecond = Math.max(1, speedKmh * 1000 / 3600);
  const finalStopIndex = Math.max(0, stopDistancesMeters.length - 1);
  for (let index = 1; index <= finalStopIndex; index++) {
    const segment = Math.max(0, stopDistancesMeters[index] - stopDistancesMeters[index - 1]);
    const driveSeconds = segment / metersPerSecond;
    if (remaining < driveSeconds) {
      travelledMeters = stopDistancesMeters[index - 1] + remaining * metersPerSecond;
      return { travelledMeters, currentStopIndex, dwellRemainingSeconds: 0, status: "running", speedKmh };
    }
    travelledMeters = stopDistancesMeters[index];
    remaining -= driveSeconds;
    currentStopIndex = index;
    if (index === finalStopIndex) return { travelledMeters: Math.min(totalDistanceMeters, travelledMeters), currentStopIndex, dwellRemainingSeconds: 0, status: "completed", speedKmh };
    if (remaining < STOP_DWELL_SECONDS) {
      dwellRemainingSeconds = STOP_DWELL_SECONDS - remaining;
      return { travelledMeters, currentStopIndex, dwellRemainingSeconds, status: "at-stop", speedKmh };
    }
    remaining -= STOP_DWELL_SECONDS;
  }
  return { travelledMeters: 0, currentStopIndex: 0, dwellRemainingSeconds, status: "running", speedKmh };
}

export function rankTripOptions<T extends { totalSeconds: number }>(options: T[]): T[] {
  return [...options].sort((a, b) => a.totalSeconds - b.totalSeconds);
}
