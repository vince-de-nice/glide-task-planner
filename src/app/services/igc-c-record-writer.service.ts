import { Injectable } from '@angular/core';
import { TaskDeclaration } from '../models/task-declaration.model';
import {
  formatIgcLatitude,
  formatIgcLongitude,
  IGC_ZERO_COORD
} from '../utils/geo-format.util';
import { igcKeywordForRole } from './task-declaration.resolver';

@Injectable({
  providedIn: 'root'
})
export class IgcCRecordWriterService {
  generate(declaration: TaskDeclaration, turnPointCount: number): string {
    const lines: string[] = [];
    const d = declaration.declaredAtUtc;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    const tt = String(turnPointCount).padStart(2, '0');
    const desc = declaration.taskName.substring(0, 40).trim() || 'VAV Task';

    lines.push(
      `C ${dd} ${mm} ${yy} ${hh} ${min} ${ss} 000000 0000 ${tt} ${desc}`
    );

    for (const p of declaration.points) {
      const keyword = igcKeywordForRole(p.role);
      const useZero =
        (p.role === 'takeoff' || p.role === 'landing') &&
        p.latitude === 0 &&
        p.longitude === 0;
      const coord = useZero
        ? IGC_ZERO_COORD
        : `${formatIgcLatitude(p.latitude)} ${formatIgcLongitude(p.longitude)}`;
      const label = `${keyword} ${p.name}`.trim();
      lines.push(`C ${coord} ${label}`);
    }

    return lines.join('\n') + '\n';
  }
}
