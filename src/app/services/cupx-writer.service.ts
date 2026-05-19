import { Injectable, inject } from '@angular/core';
import type JSZip from 'jszip';
import { TranslateService } from '../i18n/translate.service';

type JsZipCtor = typeof JSZip;

@Injectable({
  providedIn: 'root'
})
export class CupxWriterService {
  private i18n = inject(TranslateService);

  get noPicsWarning(): string {
    return this.i18n.t('exportWarnings.cupxNoPhotos');
  }

  private jsZipPromise: Promise<JsZipCtor> | null = null;

  async buildCupxBlob(pointsCupContent: string): Promise<Blob> {
    const JSZip = await this.loadJsZip();
    const picsZip = await this.buildEmptyPicsZip(JSZip);
    const pointsZip = await this.buildPointsZip(JSZip, pointsCupContent);
    return new Blob([picsZip, pointsZip], {
      type: 'application/octet-stream'
    });
  }

  private loadJsZip(): Promise<JsZipCtor> {
    if (!this.jsZipPromise) {
      this.jsZipPromise = import('jszip').then(
        mod => (mod as { default: JsZipCtor }).default ?? (mod as unknown as JsZipCtor)
      );
    }
    return this.jsZipPromise;
  }

  private async buildEmptyPicsZip(JSZip: JsZipCtor): Promise<ArrayBuffer> {
    const zip = new JSZip();
    return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
  }

  private async buildPointsZip(
    JSZip: JsZipCtor,
    cupContent: string
  ): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file('POINTS.CUP', cupContent);
    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  }
}
