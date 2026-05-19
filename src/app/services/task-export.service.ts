import { Injectable, inject } from '@angular/core';
import { CircuitLeg } from '../models/circuit.model';
import {
  TaskDeclaration,
  TaskExportOptions,
  DEFAULT_TASK_EXPORT_RADIUS_M
} from '../models/task-declaration.model';
import { Waypoint } from '../models/waypoint.model';
import { FlarmDeclaration } from '../models/flarm-profile.model';
import { FlarmConfigService, flarmCfgFilename } from './flarm-config.service';
import { CupDatabaseService } from './cup-database.service';
import { TaskDeclarationResolver } from './task-declaration.resolver';
import { TaskValidationService, TaskValidationResult } from './task-validation.service';
import { TaskRuleEngineService } from './task-rule-engine.service';
import { IgcCRecordWriterService } from './igc-c-record-writer.service';
import { TskWriterService } from './tsk-writer.service';
import { CupxWriterService } from './cupx-writer.service';
import { downloadBlob, downloadTextFile, safeExportBasename } from '../utils/download-blob.util';

export type TaskExportFormat = 'flarm' | 'cup' | 'cupx' | 'tsk' | 'igc-crecords';

export interface TaskExportContext {
  legs: CircuitLeg[];
  waypoints: Waypoint[];
  taskName: string;
  flarmDeclaration?: FlarmDeclaration;
  options?: Partial<TaskExportOptions>;
}

export interface TaskExportOutput {
  content: string;
  validation: TaskValidationResult;
  declaration: TaskDeclaration;
  extraWarnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskExportService {
  private flarmConfig = inject(FlarmConfigService);
  private cupDatabase = inject(CupDatabaseService);
  private resolver = inject(TaskDeclarationResolver);
  private validation = inject(TaskValidationService);
  private igcWriter = inject(IgcCRecordWriterService);
  private tskWriter = inject(TskWriterService);
  private cupxWriter = inject(CupxWriterService);
  private ruleEngine = inject(TaskRuleEngineService);

  buildExport(
    format: TaskExportFormat,
    ctx: TaskExportContext
  ): TaskExportOutput | { error: string } {
    const regulation =
      ctx.options?.regulation ??
      this.ruleEngine.resolveRegulation();

    const options: TaskExportOptions = {
      defaultRadiusM:
        ctx.options?.defaultRadiusM ?? regulation.radiiM.turnpointM,
      declarationTimeUtc: ctx.options?.declarationTimeUtc,
      regulation
    };

    const wpMap = new Map(ctx.waypoints.map(w => [w.id, w]));
    const orderedWps = ctx.legs
      .map(l => wpMap.get(l.waypointId))
      .filter((w): w is Waypoint => w !== undefined);

    const declaration = this.resolver.resolve(
      ctx.legs,
      wpMap,
      ctx.taskName,
      options
    );

    const cupNames = this.validation.buildCupNameSet(ctx.waypoints);
    const validation = this.validation.validateForExport(
      ctx.legs,
      declaration,
      wpMap,
      regulation,
      format === 'cup' || format === 'cupx' ? cupNames : undefined
    );

    if (!validation.valid) {
      return { error: validation.errors.join(' ') };
    }

    const extraWarnings: string[] = [...this.ruleEngine.complianceSummary(regulation)];
    let content = '';

    switch (format) {
      case 'flarm': {
        const flarmDecl: FlarmDeclaration = ctx.flarmDeclaration ?? {
          taskName: ctx.taskName,
          pilotName: '',
          gliderType: '',
          gliderId: '',
          compId: '',
          compClass: '',
          logInterval: 4
        };
        content = this.flarmConfig.generateFlarmCfgTxt(orderedWps, flarmDecl);
        break;
      }
      case 'cup':
        content = this.cupDatabase.exportCupWithTask(ctx.legs, ctx.taskName, options);
        break;
      case 'tsk':
        content = this.tskWriter.generateFromLegs(
          ctx.legs,
          wpMap,
          ctx.taskName,
          options.defaultRadiusM,
          regulation
        );
        break;
      case 'igc-crecords': {
        const turnCount = this.resolver.countTurnPoints(ctx.legs);
        content = this.igcWriter.generate(declaration, turnCount);
        break;
      }
      case 'cupx':
        content = this.cupDatabase.exportCupWithTask(ctx.legs, ctx.taskName, options);
        extraWarnings.push(this.cupxWriter.noPicsWarning);
        break;
    }

    return {
      content,
      validation: {
        ...validation,
        warnings: [...validation.warnings, ...extraWarnings, ...declaration.warnings]
      },
      declaration,
      extraWarnings
    };
  }

  preview(format: TaskExportFormat, ctx: TaskExportContext): string {
    const result = this.buildExport(format, ctx);
    if ('error' in result) {
      return '';
    }
    return result.content;
  }

  async download(
    format: TaskExportFormat,
    ctx: TaskExportContext
  ): Promise<TaskValidationResult | { error: string }> {
    const result = this.buildExport(format, ctx);
    if ('error' in result) {
      return { error: result.error };
    }

    const base = safeExportBasename(ctx.taskName, 'circuit');

    if (format === 'cupx') {
      await this.downloadCupx(result.content, `${base}.cupx`);
      return result.validation;
    }

    const filenames: Record<Exclude<TaskExportFormat, 'cupx'>, string> = {
      flarm: flarmCfgFilename(ctx.taskName),
      cup: `${base}.cup`,
      tsk: `${base}.tsk`,
      'igc-crecords': `${base}-c-records.txt`
    };

    const mime =
      format === 'tsk' ? 'application/xml;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadTextFile(result.content, filenames[format], mime);
    return result.validation;
  }

  private async downloadCupx(cupContent: string, filename: string): Promise<void> {
    const blob = await this.cupxWriter.buildCupxBlob(cupContent);
    downloadBlob(blob, filename);
  }
}
