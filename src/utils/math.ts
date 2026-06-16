/**
 * Utility Functions
 */

import { Vector3 } from '../types';

export function Vector3Add(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

export function Vector3Sub(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

export function Vector3Scale(v: Vector3, scale: number): Vector3 {
  return {
    x: v.x * scale,
    y: v.y * scale,
    z: v.z * scale,
  };
}

export function Vector3Magnitude(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function Vector3Normalize(v: Vector3): Vector3 {
  const mag = Vector3Magnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return Vector3Scale(v, 1 / mag);
}

export function Vector3Distance(a: Vector3, b: Vector3): number {
  return Vector3Magnitude(Vector3Sub(a, b));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  if (meters < 1e6) return `${(meters / 1000).toFixed(1)} km`;
  if (meters < 1e9) return `${(meters / 1e6).toFixed(1)} Mm`;
  return `${(meters / 1e9).toFixed(1)} Gm`;
}

export function formatVelocity(ms: number): string {
  return `${ms.toFixed(1)} m/s`;
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
