import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface FileData {
  name: string;
  size: string;
  modified: string;
  iconColor: string;
  iconSVG: string;
}

@Component({
  selector: 'app-files-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './files-container.component.html',
})
export class FilesContainerComponent {
  @Input() currentPath!: string;
  @Input() files: FileData[] = [];

  constructor(private sanitizer: DomSanitizer) {}

  sanitizeSVG(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}