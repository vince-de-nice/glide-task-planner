import { Injectable } from '@angular/core';
import { Waypoint, WaypointCupFields } from '../models/waypoint.model';

const DEFAULT_HEADER =
  'name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics';

@Injectable({
  providedIn: 'root'
})
export class CupWriterService {
  generateCupFile(headerLine: string, waypoints: Waypoint[]): string {
    const header = headerLine?.trim() || DEFAULT_HEADER;
    const lines = [header, ...waypoints.map(wp => this.waypointToCupLine(wp))];
    return lines.join('\n') + '\n';
  }

  private waypointToCupLine(wp: Waypoint): string {
    const cup = this.resolveCupFields(wp);
    const lat = this.formatLatitude(wp.latitude);
    const lon = this.formatLongitude(wp.longitude);
    const elev = wp.elevation != null ? `${wp.elevation}m` : '';
    const name = this.csvField(wp.name, true);
    const code = this.csvField(wp.code ?? wp.name.slice(0, 6), false);
    const country = this.csvField(wp.country ?? '', false);
    const desc = this.csvField(wp.description ?? '', true);

    return [
      name,
      code,
      country,
      lat,
      lon,
      elev,
      cup.style,
      cup.rwdir ?? '',
      cup.rwlen ?? '',
      cup.rwwidth ?? '',
      cup.freq ?? '',
      desc,
      cup.userdata ?? '',
      cup.pics ?? ''
    ].join(',');
  }

  private resolveCupFields(wp: Waypoint): WaypointCupFields {
    if (wp.cupFields?.style) {
      return wp.cupFields;
    }
    return { style: this.typeToStyle(wp.type) };
  }

  private typeToStyle(type: Waypoint['type']): string {
    switch (type) {
      case 'airfield':
        return '5';
      case 'landable':
        return '3';
      default:
        return '1';
    }
  }

  private formatLatitude(lat: number): string {
    return this.formatCoordinate(lat, 'lat');
  }

  private formatLongitude(lon: number): string {
    return this.formatCoordinate(lon, 'lon');
  }

  private formatCoordinate(value: number, kind: 'lat' | 'lon'): string {
    const hemisphere =
      kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
    const abs = Math.abs(value);
    const degreeDigits = kind === 'lat' ? 2 : 3;
    const degrees = Math.floor(abs);
    const minutes = (abs - degrees) * 60;
    const degStr = String(degrees).padStart(degreeDigits, '0');
    const minStr = minutes.toFixed(3).padStart(6, '0');
    return `${degStr}${minStr}${hemisphere}`;
  }

  private csvField(value: string, quoteIfNeeded: boolean): string {
    const v = value.replace(/"/g, '""');
    if (quoteIfNeeded || v.includes(',') || v.includes('"')) {
      return `"${v}"`;
    }
    return v;
  }
}
