import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { API_BASE_URL, KeyPairResponse } from './ApiConfig';

@Injectable({
  providedIn: 'root'
})
export class KeyService {
  constructor(private http: HttpClient) {}

  generateRsaKeyPair(): Observable<KeyPairResponse> {
    return this.http.post<KeyPairResponse>(`${API_BASE_URL}/keys/rsa`, null);
  }

  isBackendAvailable(): Observable<boolean> {
    return this.http.get(`${API_BASE_URL}/health`).pipe(
      timeout(3000),
      map(() => true),
      catchError(() => of(false))
    );
  }
}
