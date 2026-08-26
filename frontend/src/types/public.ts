/** Shapes aligned with backend ProfessionalsService / ServicesService */

export type ProfileSnippet = {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type LocationSnippet = {
  id: string;
  name: string;
  address: string;
  city: string;
  province?: string | null;
};

export type ServiceSnippet = {
  id: string;
  name: string;
  slug: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type ProfessionalServiceItem = {
  id: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string | null;
  isActive?: boolean;
  service: ServiceSnippet;
};

export type ProfessionalListItem = {
  id: string;
  slug: string;
  title: string;
  bio?: string | null;
  coverImageUrl?: string | null;
  status: string;
  isFeatured?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number | null;
  user?: { profile?: ProfileSnippet | null } | null;
  locations?: { location: LocationSnippet; isPrimary?: boolean }[];
  professionalServices?: {
    service: { name: string; slug: string };
  }[];
};

export type ProfessionalsSearchResponse = {
  items: ProfessionalListItem[];
  meta: { page: number; limit: number; total: number };
};

export type WorkingHourBreak = {
  startTime: string;
  endTime: string;
};

export type WorkingHour = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
  breaks?: WorkingHourBreak[];
};

export type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  customer?: { profile?: { displayName?: string | null } | null } | null;
};

export type ProfessionalDetail = ProfessionalListItem & {
  locations: { location: LocationSnippet; isPrimary?: boolean }[];
  professionalServices: ProfessionalServiceItem[];
  workingHours: WorkingHour[];
  reviews: ReviewItem[];
};

export type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  services?: ServiceItem[];
};

export type ServiceItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  category?: ServiceCategory | null;
  categoryId?: string;
};
