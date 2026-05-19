import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectButton } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '../../i18n/translate.service';
import { AppLocale } from '../../i18n/locale';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [SelectButton, FormsModule],
  template: `
    <p-selectButton
      [options]="options"
      optionLabel="label"
      optionValue="value"
      [ngModel]="locale()"
      (ngModelChange)="onChange($event)"
      [allowEmpty]="false"
      size="small"
      [attr.aria-label]="ariaLabel"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSwitcherComponent {
  private readonly i18n = inject(TranslateService);

  readonly locale = this.i18n.locale;

  readonly options: { label: string; value: AppLocale }[] = [
    { label: 'FR', value: 'fr' },
    { label: 'EN', value: 'en' }
  ];

  get ariaLabel(): string {
    return this.i18n.t('app.lang.switch');
  }

  onChange(value: AppLocale): void {
    this.i18n.setLocale(value);
  }
}
