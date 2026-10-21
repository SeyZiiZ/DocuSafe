import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, EncryptionResponse } from './ApiConfig';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private apiUrl = `${API_BASE_URL}/encryption`;

  constructor(private http: HttpClient) {}

  sendToBackend(formData: FormData): Observable<EncryptionResponse> {
    return this.http.post<EncryptionResponse>(this.apiUrl, formData);
  }
}
