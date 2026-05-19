import { Injectable, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '../i18n/translate.service';

export interface ConfirmOptions {
  header?: string;
  message: string;
  acceptLabel?: string;
  rejectLabel?: string;
  icon?: string;
  acceptButtonStyleClass?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UiFeedbackService {
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private i18n = inject(TranslateService);

  success(summary: string, detail?: string, life = 2500): void {
    this.messageService.add({
      severity: 'success',
      summary,
      detail,
      life
    });
  }

  info(summary: string, detail?: string, life = 3000): void {
    this.messageService.add({
      severity: 'info',
      summary,
      detail,
      life
    });
  }

  warn(summary: string, detail?: string, life = 4000): void {
    this.messageService.add({
      severity: 'warn',
      summary,
      detail,
      life
    });
  }

  error(summary: string, detail?: string, life = 5000): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life
    });
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmationService.confirm({
        header: options.header ?? this.i18n.t('common.confirm'),
        message: options.message,
        icon: options.icon ?? 'pi pi-exclamation-triangle',
        acceptLabel: options.acceptLabel ?? this.i18n.t('common.yes'),
        rejectLabel: options.rejectLabel ?? this.i18n.t('common.no'),
        acceptButtonStyleClass: options.acceptButtonStyleClass,
        accept: () => resolve(true),
        reject: () => resolve(false)
      });
    });
  }
}
