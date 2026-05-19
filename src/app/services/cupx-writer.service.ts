import { Injectable } from '@angular/core';
import type JSZip from 'jszip';

const CUPX_NO_PICS_WARNING =
  'CUPX généré sans photos (pics.zip minimal) : les images de la base ne sont pas incluses.';

type JsZipCtor = typeof JSZip;

@Injectable({
  providedIn: 'root'
})
export class CupxWriterService {
  readonly noPicsWarning = CUPX_NO_PICS_WARNING;
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
