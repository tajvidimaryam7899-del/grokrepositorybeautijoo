import { apiClient } from './api';

export type ServiceFilterCategory = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  sortOrder?: number;
  allowed?: boolean;
  status?: 'pending' | 'approved' | 'rejected' | null;
};

export async function fetchMyServiceFilterCategories(psId: string) {
  return apiClient.get<ServiceFilterCategory[]>(`/professionals/me/services/${psId}/filter-categories`);
}

export async function requestMyServiceFilterCategory(psId: string, categoryId: string) {
  return apiClient.post<ServiceFilterCategory[]>(`/professionals/me/services/${psId}/filter-categories`, { categoryId });
}

export async function fetchPublicServiceFilterCategories(serviceId: string) {
  return apiClient.get<ServiceFilterCategory[]>(`/services/${serviceId}/filter-categories`);
}
