/** MEDIBOOK wire shapes — mirror server/src/lib/book/catalog.js and bookings.js public shapes. */

export type BookCategoryId =
  | 'DENTAL' | 'BEAUTY' | 'HAIR' | 'NAILS' | 'AESTHETIC' | 'SPA' | 'CLINIC' | 'FITNESS' | 'OPTICS' | 'LAB' | 'MIND' | 'PHYSIO' | 'TATTOO' | 'OTHER';

export type BookHoursRange = { from: string; to: string };
/** Keys "0"–"6" (0 = Sunday); an empty list = closed. */
export type BookHours = Record<string, BookHoursRange[]>;

export type BookBusinessCard = {
  id: string;
  slug: string;
  name: string;
  category: BookCategoryId;
  categoryLabel: string;
  tags: string[];
  address: string | null;
  city: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  rating: number | null;
  ratingCount: number;
  claimed: boolean;
  bookable: boolean;
  coverUrl: string | null;
  logoUrl: string | null;
  openNow: boolean | null;
  closesAt: string | null;
  opensAt: string | null;
  distanceKm: number | null;
  fromPrice: number | null;
  favorite: boolean;
};

export type BookService = {
  id: string;
  group: string | null;
  name: string;
  nameEn: string;
  description: string | null;
  durationMin: number;
  bufferMin: number;
  price: number | null;
  priceTo: number | null;
  currency: string;
  online: boolean;
  active: boolean;
  sortOrder: number;
  /** 1 = a normal visit; 2+ = a group class — that many people book the same start with the same trainer. */
  seats?: number;
};

export type BookStaff = {
  id: string;
  name: string;
  title: string | null;
  imageUrl: string | null;
  color: string | null;
  serviceIds: string[];
  bookable: boolean;
};

export type BookDiscount = {
  id: string;
  title: string;
  kind: 'PERCENT' | 'FIXED';
  value: number;
  serviceIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  weekdays: number[];
  hoursFrom: string | null;
  hoursTo: string | null;
  code: string | null;
};

export type BookReview = { id: string; rating: number; text: string | null; reply: string | null; createdAt: string; author: string };

export type BookSettings = {
  slotMinutes: number;
  leadMinutes: number;
  horizonDays: number;
  cancelHours: number;
  autoConfirm: boolean;
  onlineBooking: boolean;
  allowStaffChoice: boolean;
  bookingNote: string;
  loyalty?: { cashbackPercent: number; welcomeBonus: number; maxRedeemPercent: number };
};

/** The viewer's own loyalty at one place: bonus to spend, live memberships. */
export type BookViewerLoyalty = { bonusBalance: number; memberships: Array<{ id: string; title: string; kind: 'VISITS' | 'AMOUNT'; visitsLeft: number | null; amountLeft: number | null; endsOn: string }> };

export type BookBusinessDetail = BookBusinessCard & {
  description: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  hours: BookHours;
  gallery: string[];
  settings: BookSettings;
  services: BookService[];
  staff: BookStaff[];
  discounts: BookDiscount[];
  reviews: BookReview[];
  status: 'LISTED' | 'PENDING' | 'CLAIMED' | 'HIDDEN';
  me?: BookViewerLoyalty | null;
  /** Other locations of the same chain, nearest to this one first. */
  branches?: BookBusinessCard[];
};

export type BookPin = { id: string; slug: string; name: string; category: BookCategoryId; lat: number; lng: number; claimed: boolean; rating: number | null };

/** A free start; for a group class it is a seat in a running class (`classId`) with `seatsLeft` of `seats`. */
export type BookSlot = { time: string; startsAt: string; staffIds: string[]; classId?: string; seats?: number; seatsLeft?: number; booked?: number };
export type BookAvailability = { date: string; serviceId: string; serviceIds?: string[]; durationMin: number; seats?: number; scheduled?: boolean; slots: BookSlot[]; closed: boolean; reason?: string };
export type BookDayStrip = { from: string; days: Array<{ date: string; count: number; closed: boolean }> };

export type BookAppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export type BookDayPart = 'MORNING' | 'AFTERNOON' | 'EVENING';
export type BookWaitlistStatus = 'WAITING' | 'OFFERED' | 'BOOKED' | 'CANCELLED' | 'EXPIRED';
/** A waiting-list entry: what the client wants, for which days and parts of the day, and the last offer. */
export type BookWaitlistEntry = {
  id: string;
  businessId: string;
  business?: { id: string; slug: string | null; name: string; category: BookCategoryId | null; address: string | null; phone: string | null; logoUrl: string | null; coverUrl: string | null };
  serviceId: string | null;
  serviceIds: string[];
  serviceName: string;
  staffId: string | null;
  staffName: string | null;
  staffColor: string | null;
  clientName: string;
  fromDate: string;
  toDate: string;
  dayParts: BookDayPart[];
  note: string | null;
  status: BookWaitlistStatus;
  source: 'APP' | 'WEB' | 'BUSINESS';
  offeredAt: string | null;
  offeredStartsAt: string | null;
  offeredStaffId: string | null;
  offeredStaffName: string | null;
  offerCount: number;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One service inside a booking; a plain booking has exactly one. */
export type BookAppointmentService = { id: string | null; name: string; durationMin: number; price: number | null; discountAmount: number | null };

export type BookAppointment = {
  id: string;
  businessId: string;
  business?: {
    id: string;
    slug: string | null;
    name: string;
    category: BookCategoryId | null;
    address: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    logoUrl: string | null;
    coverUrl: string | null;
  };
  serviceId: string | null;
  /** All services joined with „ + “ when the booking holds several. */
  serviceName: string;
  services?: BookAppointmentService[];
  staffId: string | null;
  staffName: string | null;
  staffColor: string | null;
  /** A seat in a group class: the class and its seats taken ÷ seats (null for a plain visit). */
  classId?: string | null;
  classSeats?: number | null;
  classBooked?: number | null;
  clientName: string;
  clientPhone: string | null;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  status: BookAppointmentStatus;
  source: 'APP' | 'WEB' | 'BUSINESS';
  price: number | null;
  discountAmount: number | null;
  note: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  reviewed: boolean;
  canCancelFree: boolean;
  cancelHours: number;
  createdAt: string;
};

export type BookCategory = { id: BookCategoryId; ka: string; en: string; color: string };
