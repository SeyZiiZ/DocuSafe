import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-feature-card',
  imports: [CommonModule],
  templateUrl: './feature-card.component.html',
})
export class FeatureCardComponent {
  @Input() title!: string;
  @Input() description!: string;
  @Input() colorClasses!: string;

  private _iconSVG!: string;
  safeIconSVG!: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {}

  @Input()
  set iconSVG(value: string) {
    this._iconSVG = value;
    this.safeIconSVG = this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
