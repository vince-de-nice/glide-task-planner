import { Injectable } from '@angular/core';
import JSZip from 'jszip';

const CUPX_NO_PICS_WARNING =
  'CUPX généré sans photos (pics.zip minimal) : les images de la base ne sont pas incluses.';

@Injectable({
  providedIn: 'root'
})
export class CupxWriterService {
  readonly noPicsWarning = CUPX_NO_PICS_WARNING;

  async buildCupxBlob(pointsCupContent: string): Promise<Blob> {
    const picsZip = await this.buildEmptyPicsZip();
    const pointsZip = await this.buildPointsZip(pointsCupContent);
    return new Blob([picsZip, pointsZip], {
      type: 'application/octet-stream'
    });
  }

  private async buildEmptyPicsZip(): Promise<ArrayBuffer> {
    const zip = new JSZip();
    return zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
  }

  private async buildPointsZip(cupContent: string): Promise<ArrayBuffer> {
    const zip = new JSZip();
    zip.file('POINTS.CUP', cupContent);
    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  }
}
