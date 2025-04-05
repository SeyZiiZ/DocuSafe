import { Component, Output, EventEmitter } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Output() disconnectClick = new EventEmitter<void>();

  disconnect() {
    this.disconnectClick.emit();
  }
}
