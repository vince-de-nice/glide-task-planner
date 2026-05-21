import { Injectable } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';

export interface CupWaypoint {
  name: string;
  code: string;
  country: string;
  lat: string;
  lon: string;
  elev: string;
  style: string;
  rwdir?: string;
  rwlen?: string;
  rwwidth?: string;
  freq?: string;
  desc?: string;
  userdata?: string;
  pics?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CupParserService {
  /**
   * Parse a CUP file content and return waypoints
   */
  extractHeaderLine(content: string): string {
    const lines = content.split('\n').filter(line => line.trim());
    const headerLineIndex = lines.findIndex(
      line => line.toLowerCase().includes('name') && line.toLowerCase().includes('lat')
    );
    if (headerLineIndex === -1) {
      throw new Error('Fichier CUP invalide : ligne d’en-tête introuvable');
    }
    return lines[headerLineIndex].trim();
  }

  parseCupFile(content: string): Waypoint[] {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return [];
    }

    const headerLineIndex = lines.findIndex(
      line => line.toLowerCase().includes('name') && line.toLowerCase().includes('lat')
    );

    if (headerLineIndex === -1) {
      throw new Error('Fichier CUP invalide : ligne d’en-tête introuvable');
    }

    const header = this.parseHeader(lines[headerLineIndex]);
    const waypoints: Waypoint[] = [];

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith('-----') ||
        line.startsWith('Related') ||
        line.toLowerCase().startsWith('obszone=')
      ) {
        break;
      }
      try {
        const cupWaypoint = this.parseWaypointLine(lines[i], header);
        const waypoint = this.convertToWaypoint(cupWaypoint);
        waypoints.push(waypoint);
      } catch (e) {
        console.warn(`Failed to parse line ${i + 1}: ${lines[i]}`, e);
      }
    }

    return waypoints;
  }

  private parseHeader(headerLine: string): string[] {
    // Remove quotes and split by comma
    return headerLine.split(',').map(field => field.trim().replace(/"/g, '').toLowerCase());
  }

  private parseWaypointLine(line: string, header: string[]): CupWaypoint {
    // Parse CSV line handling quoted fields
    const fields = this.parseCsvLine(line);
    
    const waypoint: Partial<CupWaypoint> = {};
    
    header.forEach((fieldName, index) => {
      if (fields[index] !== undefined) {
        waypoint[fieldName as keyof CupWaypoint] = fields[index].trim();
      }
    });

    // Validate required fields
    if (!waypoint.name || !waypoint.lat || !waypoint.lon) {
      throw new Error('Missing required fields: name, lat, or lon');
    }

    return waypoint as CupWaypoint;
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current);
    return fields;
  }

  private convertToWaypoint(cupWaypoint: CupWaypoint): Waypoint {
    const lat = this.parseCoordinate(cupWaypoint.lat);
    const lon = this.parseCoordinate(cupWaypoint.lon);
    const elevation = this.parseElevation(cupWaypoint.elev);
    const type = this.determineWaypointType(cupWaypoint.style);

    return {
      id: this.generateId(cupWaypoint.name, cupWaypoint.code),
      name: cupWaypoint.name.replace(/"/g, ''),
      code: cupWaypoint.code?.replace(/"/g, '') || undefined,
      country: cupWaypoint.country?.replace(/"/g, '') || undefined,
      latitude: lat,
      longitude: lon,
      elevation: elevation,
      description: cupWaypoint.desc?.replace(/"/g, ''),
      type,
      cupFields: {
        style: cupWaypoint.style || '1',
        rwdir: cupWaypoint.rwdir,
        rwlen: cupWaypoint.rwlen,
        rwwidth: cupWaypoint.rwwidth,
        freq: cupWaypoint.freq,
        userdata: cupWaypoint.userdata,
        pics: cupWaypoint.pics
      }
    };
  }

  private parseCoordinate(coord: string): number {
    // SeeYou CUP : latitude DDMM.MMMH, longitude DDDMM.MMMH (H = N/S/E/W)
    // Ex. 4344.167N → 43° 44.167', 00547.000E → 5° 47.000'
    const cleaned = coord.trim().toUpperCase();
    const direction = cleaned.slice(-1);
    if (!['N', 'S', 'E', 'W'].includes(direction)) {
      throw new Error(`Hémisphère invalide : ${coord}`);
    }

    const numericPart = cleaned.slice(0, -1);
    const degreeDigits = direction === 'E' || direction === 'W' ? 3 : 2;

    if (numericPart.length <= degreeDigits) {
      throw new Error(`Coordonnée CUP invalide : ${coord}`);
    }

    const degrees = parseInt(numericPart.slice(0, degreeDigits), 10);
    const minutes = parseFloat(numericPart.slice(degreeDigits));

    if (Number.isNaN(degrees) || Number.isNaN(minutes)) {
      throw new Error(`Coordonnée CUP invalide : ${coord}`);
    }

    let decimal = degrees + minutes / 60;

    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }

    return decimal;
  }

  private parseElevation(elev: string): number | undefined {
    if (!elev) return undefined;
    
    const cleaned = elev.trim().toLowerCase();
    const numericValue = parseFloat(cleaned);
    
    if (isNaN(numericValue)) return undefined;
    
    // Handle unit suffixes
    if (cleaned.endsWith('ft') || cleaned.endsWith("'")) {
      return Math.round(numericValue * 0.3048); // Convert feet to meters
    }
    
    if (cleaned.endsWith('m')) {
      return Math.round(numericValue);
    }
    
    // Default to meters
    return Math.round(numericValue);
  }

  private determineWaypointType(style: string): Waypoint['type'] {
    const styleNum = parseInt(style);
    
    // SeeYou waypoint styles:
    // 1 = Normal/Turnpoint
    // 2 = Airfield
    // 3 = Outlanding
    // 4 = Glider site
    // 5 = Airport
    switch (styleNum) {
      case 2:
      case 4:
      case 5:
        return 'airfield';
      case 3:
        return 'landable';
      case 1:
      default:
        return 'turnpoint';
    }
  }

  private generateId(name: string, code: string): string {
    return `${code || name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
