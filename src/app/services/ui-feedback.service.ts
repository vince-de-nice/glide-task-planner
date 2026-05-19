import { Injectable, inject } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';

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
        header: options.header ?? 'Confirmation',
        message: options.message,
        icon: options.icon ?? 'pi pi-exclamation-triangle',
        acceptLabel: options.acceptLabel ?? 'Oui',
        rejectLabel: options.rejectLabel ?? 'Non',
        acceptButtonStyleClass: options.acceptButtonStyleClass,
        accept: () => resolve(true),
        reject: () => resolve(false)
      });
    });
  }
}
