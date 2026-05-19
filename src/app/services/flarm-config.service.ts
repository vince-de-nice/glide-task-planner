import { Injectable } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';
import { FlarmDeclaration, FlarmProfile } from '../models/flarm-profile.model';

@Injectable({
  providedIn: 'root'
})
export class FlarmConfigService {
  private static readonly MAX_WAYPOINT_DESC = 50;
  private static readonly MAX_TASK_NAME = 50;
  private static readonly MAX_PILOT = 47;
  private static readonly MAX_GLIDER_TYPE = 31;
  private static readonly MAX_GLIDER_ID = 15;
  private static readonly MAX_COMP = 15;

  generateFlarmCfgTxt(waypoints: Waypoint[], declaration: FlarmDeclaration): string {
    const lines: string[] = [];

    this.appendProfileLines(lines, declaration);

    lines.push(`$PFLAC,S,NEWTASK,${this.sanitizeValue(declaration.taskName, FlarmConfigService.MAX_TASK_NAME, defaultTaskName())}`);

    for (const wp of waypoints) {
      const lat = formatFlarmLatitude(wp.latitude);
      const lon = formatFlarmLongitude(wp.longitude);
      const desc = this.sanitizeValue(wp.name, FlarmConfigService.MAX_WAYPOINT_DESC, 'WP');
      lines.push(`$PFLAC,S,ADDWP,${lat},${lon},${desc}`);
    }

    return lines.join('\n') + '\n';
  }

  private appendProfileLines(lines: string[], profile: FlarmProfile): void {
    if (profile.pilotName.trim()) {
      lines.push('//Pilot Name');
      lines.push(
        `$PFLAC,S,PILOT,${this.sanitizeValue(profile.pilotName, FlarmConfigService.MAX_PILOT)}`
      );
      lines.push('');
    }

    if (profile.gliderType.trim()) {
      lines.push('//Aircraft Type');
      lines.push(
        `$PFLAC,S,GLIDERTYPE,${this.sanitizeValue(profile.gliderType, FlarmConfigService.MAX_GLIDER_TYPE)}`
      );
      lines.push('');
    }

    if (profile.gliderId.trim()) {
      lines.push('// Aircraft registration');
      lines.push(
        `$PFLAC,S,GLIDERID,${this.sanitizeValue(profile.gliderId, FlarmConfigService.MAX_GLIDER_ID)}`
      );
      lines.push('');
    }

    if (profile.compId.trim()) {
      lines.push('//Competition ID');
      lines.push(
        `$PFLAC,S,COMPID,${this.sanitizeValue(profile.compId, FlarmConfigService.MAX_COMP)}`
      );
      lines.push('');
    }

    if (profile.compClass.trim()) {
      lines.push('//Competition class');
      lines.push(
        `$PFLAC,S,COMPCLASS,${this.sanitizeValue(profile.compClass, FlarmConfigService.MAX_COMP)}`
      );
      lines.push('');
    }

    const logInt = clampLogInterval(profile.logInterval);
    lines.push('//Logger interval');
    lines.push(`$PFLAC,S,LOGINT,${logInt}`);
    lines.push('');
  }

  downloadFlarmCfg(
    waypoints: Waypoint[],
    declaration: FlarmDeclaration,
    filename = 'flarmcfg.txt'
  ): void {
    const content = this.generateFlarmCfgTxt(waypoints, declaration);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private sanitizeValue(value: string, maxLen: number, fallback = ''): string {
    const trimmed = (value.trim() || fallback).replace(/,/g, ' ');
    return trimmed.substring(0, maxLen);
  }
}

/** Convert decimal degrees to FLARM latitude DDMMmmmN/S */
export function formatFlarmLatitude(latitude: number): string {
  return formatFlarmCoordinate(latitude, 'lat');
}

/** Convert decimal degrees to FLARM longitude DDDMMmmmE/W */
export function formatFlarmLongitude(longitude: number): string {
  return formatFlarmCoordinate(longitude, 'lon');
}

function formatFlarmCoordinate(value: number, type: 'lat' | 'lon'): string {
  const hemisphere =
    type === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  const minutesTotal = (abs - degrees) * 60;
  let minutes = Math.floor(minutesTotal);
  let thousandths = Math.round((minutesTotal - minutes) * 1000);

  if (thousandths >= 1000) {
    thousandths = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  const degreeDigits = type === 'lat' ? 2 : 3;
  const degStr = String(degrees).padStart(degreeDigits, '0');
  const minStr = String(minutes).padStart(2, '0');
  const fracStr = String(thousandths).padStart(3, '0');

  return `${degStr}${minStr}${fracStr}${hemisphere}`;
}

export function defaultTaskName(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `Tache_${day}${month}${now.getFullYear()}`;
}

export function flarmCfgFilename(taskName: string): string {
  const safe = taskName
    .trim()
    .replace(/[^a-zA-Z0-9-_àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ ]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
  return `${safe || 'flarmcfg'}.txt`;
}

function clampLogInterval(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return Math.min(8, Math.max(1, Math.round(value)));
}
