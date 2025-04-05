import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private apiUrl = 'http://localhost:8080/api/encryption';

  constructor(private http: HttpClient) {}

  sendToBackend(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }
}