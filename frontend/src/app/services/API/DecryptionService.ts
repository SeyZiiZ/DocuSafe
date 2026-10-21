import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, DecryptionResponse } from './ApiConfig';

@Injectable({
  providedIn: 'root'
})
export class DecryptionService {
  private apiUrl = `${API_BASE_URL}/decryption`;

  constructor(private http: HttpClient) {}

  sendToBackend(formData: FormData): Observable<DecryptionResponse> {
    return this.http.post<DecryptionResponse>(this.apiUrl, formData);
  }
}
