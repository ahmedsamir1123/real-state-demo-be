
export interface IFinancialPolicy {
    annualDiscountRate: number,       // معدل NPV %
    handoverMonth: number,            // الاستلام بعد كام شهر
    requiredCollectionPct: number,    // المطلوب تحصيله عند الاستلام %
    maintenancePct: number             // الصيانة %
}

export interface IProject {
    name: string;

    code: string;
    location: string;

    status: string;// active | inactive
    description: string;

    financialPolicy: IFinancialPolicy;
    paymentPlans: IProjectPaymentPlan[];

    createdAt: Date;
    updatedAt: Date
}



import { Types } from 'mongoose';

export type UnitStatus = 'available' | 'on_hold' | 'reserved' | 'sold' | 'inactive';

export type UnitType =
  | 'apartment'
  | 'villa'
  | 'townhouse'
  | 'twin_house'
  | 'chalet'
  | 'office'
  | 'clinic'
  | 'retail'
  | 'hotel_unit'
  | 'other';

export type Currency = 'EGP' | 'USD';

export interface IUnitPricing {
  pricePerMeter: number;
  listPrice: number;
  currency: Currency;
  addonAmount: number;
  maintenancePct?: number;
}

export interface IUnitDetails {
  bedrooms?: number;
  bathrooms?: number;
  terraceArea?: number;
  gardenArea?: number;
  roofArea?: number;
  parkingSpaces?: number;
}

export interface IUnitHold {
  isOnHold: boolean;
  reason?: string;
  heldBy?: Types.ObjectId;
  heldAt?: Date;
  holdUntil?: Date;
}

export interface IProjectPaymentPlan {
  _id?: Types.ObjectId;
  name: string;
  code: string;
  isActive: boolean;
  isDefault: boolean;
  discountPct: number;
  downPaymentPct: number;
  years: number;
  frequencyMonths: 1 | 3 | 6 | 12;
  milestones: IMilestone[];
  installmentSegments: IInstallmentSegment[];
  settleDifferenceAtYearEnd: boolean;
}

/** @deprecated Payment plans now belong to projects. */
export type IUnitPaymentPlan = IProjectPaymentPlan;

export interface IUnit {
  _id?: Types.ObjectId;
  project: Types.ObjectId;
  code: string;
  type: UnitType;
  phase?: string;
  building?: string;
  floor?: string;
  area: number;
  pricing: IUnitPricing;
  details?: IUnitDetails;
  status: UnitStatus;
  hold?: IUnitHold;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/* =========================
   General Types
========================= */

export type OfferStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type PaymentItemType =
  | 'down_payment'
  | 'installment'
  | 'milestone'
  | 'year_end_settlement'
  | 'handover'
  | 'addon'
  | 'maintenance';

export type PaymentFrequency = 1 | 3 | 6 | 12;

/* =========================
   Customer
========================= */

export interface IOfferCustomer {
  name: string;
  phone?: string;
}

/* =========================
   Sales Agent
========================= */

export interface IOfferSalesAgent {
  name: string;
  userId?: Types.ObjectId;
}

/* =========================
   Project Snapshot
========================= */

export interface IProjectSnapshot {
  name: string;
  code: string;
}

export interface IProjectPaymentPlanSnapshot {
  sourceId?: Types.ObjectId;
  name: string;
  code?: string;
}

/** @deprecated Kept for reading offers created before project-level plans. */
export type IUnitPaymentPlanSnapshot = IProjectPaymentPlanSnapshot;

/* =========================
   Unit
========================= */

export interface IOfferUnit {
  code: string;
  type: string;

  building?: string;
  floor?: string;

  area: number;
  pricePerMeter: number;
  listPrice: number;
}

/* =========================
   Financial Inputs
========================= */

export interface IFinancialInputs {
  marketingDiscountPct: number;
  annualDiscountRate: number;

  handoverMonth: number;
  requiredCollectionPct: number;

  addonAmount: number;
  maintenancePct: number;

  includeAddonsInNpv: boolean;
}

/* =========================
   Payment Plan
========================= */

export interface IMilestone {
  month: number;
  percentage: number;

  spreadOverYearInstallments: boolean;
}

export interface IInstallmentSegment {
  fromYear: number;
  toYear: number;

  installmentAmount: number;
}

export interface IPaymentPlan {
  discountPct: number;
  downPaymentPct: number;

  years: number;

  /**
   * 1  = شهري
   * 3  = ربع سنوي
   * 6  = نصف سنوي
   * 12 = سنوي
   */
  frequencyMonths: PaymentFrequency;

  milestones: IMilestone[];

  installmentSegments: IInstallmentSegment[];

  settleDifferenceAtYearEnd: boolean;
}

/* =========================
   Calculation Result
========================= */

export interface ICalculationResult {
  finalPrice: number;

  downPaymentAmount: number;
  regularInstallmentAmount: number;
  installmentsCount: number;

  basePlanNpv: number;
  customerPlanNpv: number;
  npvDifference: number;

  collectedAtHandover: number;
  collectedAtHandoverPct: number;

  totalMaintenance: number;

  npvPassed: boolean;
  collectionPassed: boolean;
  accepted: boolean;
}

/* =========================
   Payment Schedule
========================= */

export interface IPaymentScheduleItem {
  rowId?: string;
  sortOrder?: number;
  isInstallment?: boolean;
  labelSuffix?: string;
  month: number;

  dueDate: Date;

  type: PaymentItemType;
  label: string;

  amount: number;
  cumulativeAmount: number;
  cumulativePct: number;

  isHandover: boolean;
}

/* =========================
   Maintenance Schedule
========================= */

export interface IMaintenanceScheduleItem {
  month: number;
  dueDate: Date;

  amount: number;
  percentage: number;
}

/* =========================
   Offer
========================= */

export interface IOffer {

  offerNo: string;

  project: Types.ObjectId;
  unitRef?: Types.ObjectId;
  projectPaymentPlan?: IProjectPaymentPlanSnapshot;
  /** @deprecated Legacy snapshot used by older offers. */
  unitPaymentPlan?: IUnitPaymentPlanSnapshot;

  /**
   * نخزن اسم وكود المشروع وقت إنشاء العرض،
   * حتى لو بيانات المشروع اتغيرت بعد ذلك.
   */
  projectSnapshot: IProjectSnapshot;

  customer: IOfferCustomer;

  salesAgent: IOfferSalesAgent;

  unit: IOfferUnit;

  contractDate: Date;
  validUntil: Date;

  financialInputs: IFinancialInputs;

  /**
   * النظام المعتمد من الشركة.
   */
  basePlan: IPaymentPlan;

  /**
   * عرض العميل المقترح.
   */
  customerPlan: IPaymentPlan;

  calculationResult: ICalculationResult;

  paymentSchedule: IPaymentScheduleItem[];

  maintenanceSchedule: IMaintenanceScheduleItem[];

  notes?: string;

  status: OfferStatus;

  /**
   * مهم لو منطق حساب الـNPV اتغير مستقبلًا.
   */
  calculationVersion: number;

  createdBy?: Types.ObjectId;

  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;

  createdAt?: Date;
  updatedAt?: Date;
}
