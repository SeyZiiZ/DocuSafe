import { Component } from '@angular/core';
import { CounterService } from '../counter.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hello',
  imports: [CommonModule],
  templateUrl: './hello.component.html',
  styleUrl: './hello.component.css'
})
export class HelloComponent {
  count = 0;

  constructor(private counterService: CounterService) {
    this.counterService.count$.subscribe((value) => {
      this.count = value;
    });
  }

  increment() {
    this.counterService.increment();
  }

  reset() {
    this.counterService.reset();
  }
}