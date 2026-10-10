import { Schema } from 'mongoose';

import {
  IOffer,
  IOfferCustomer,
  IOfferSalesAgent,
  IProjectSnapshot,
  IProjectPaymentPlanSnapshot,
  IOfferUnit,
  IFinancialInputs,
  IMilestone,
  IInstallmentSegment,
  IPaymentPlan,
  ICalculationResult,
  IPaymentScheduleItem,
  IMaintenanceScheduleItem
} from '../../../utils/common/interfaces';

/* =========================
   Customer
========================= */

const offerCustomerSchema = new Schema<IOfferCustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    phone: {
      type: String,
      trim: true
    }
  },
  {
    _id: false
  }
);

/* =========================
   Sales Agent
========================= */

const offerSalesAgentSchema = new Schema<IOfferSalesAgent>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    _id: false
  }
);

/* =========================
   Project Snapshot
========================= */

const projectSnapshotSchema = new Schema<IProjectSnapshot>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    }
  },
  {
    _id: false
  }
);

const projectPaymentPlanSnapshotSchema = new Schema<IProjectPaymentPlanSnapshot>(
  {
    sourceId: { type: Schema.Types.ObjectId },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true }
  },
  { _id: false }
);

/* =========================
   Unit
========================= */

const offerUnitSchema = new Schema<IOfferUnit>(
  {
    code: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      required: true,
      trim: true
    },

    building: {
      type: String,
      trim: true
    },

    floor: {
      type: String,
      trim: true
    },

    area: {
      type: Number,
      required: true,
      min: 0
    },

    pricePerMeter: {
      type: Number,
      required: true,
      min: 0
    },

    listPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

/* =========================
   Financial Inputs
========================= */

const financialInputsSchema = new Schema<IFinancialInputs>(
  {
    marketingDiscountPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    annualDiscountRate: {
      type: Number,
      required: true,
      default: 14,
      min: 0
    },

    handoverMonth: {
      type: Number,
      required: true,
      default: 48,
      min: 0
    },

    requiredCollectionPct: {
      type: Number,
      required: true,
      default: 55,
      min: 0,
      max: 100
    },

    addonAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    maintenancePct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    includeAddonsInNpv: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

/* =========================
   Milestones
========================= */

const milestoneSchema = new Schema<IMilestone>(
  {
    installmentNumber: {
      type: Number,
      min: 1
    },

    month: {
      type: Number,
      min: 0
    },

    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    spreadOverYearInstallments: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

/* =========================
   Installment Segments
========================= */

const installmentSegmentSchema =
  new Schema<IInstallmentSegment>(
    {
      fromInstallment: {
        type: Number,
        min: 1
      },

      toInstallment: {
        type: Number,
        min: 1
      },

      fromYear: {
        type: Number,
        min: 1
      },

      toYear: {
        type: Number,
        min: 1
      },

      installmentAmount: {
        type: Number,
        required: true,
        min: 0
      }
    },
    {
      _id: false
    }
  );

/* =========================
   Payment Plan
========================= */

const paymentPlanSchema = new Schema<IPaymentPlan>(
  {
    discountPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    downPaymentPct: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },

    years: {
      type: Number,
      required: true,
      min: 0.25
    },

    frequencyMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      default: 3,
      required: true
    },

    installmentDistribution: {
      type: String,
      enum: ["level", "front_loaded", "back_loaded"],
      default: "level"
    },

    loadFactorPct: {
      type: Number,
      min: 0,
      max: 95,
      default: 20
    },

    milestones: {
      type: [milestoneSchema],
      default: []
    },

    installmentSegments: {
      type: [installmentSegmentSchema],
      default: []
    },

    settleDifferenceAtYearEnd: {
      type: Boolean,
      default: false
    }
  },
  {
    _id: false
  }
);

/* =========================
   Calculation Result
========================= */

const calculationResultSchema =
  new Schema<ICalculationResult>(
    {
      finalPrice: {
        type: Number,
        required: true,
        min: 0
      },

      downPaymentAmount: {
        type: Number,
        required: true,
        min: 0
      },

      regularInstallmentAmount: {
        type: Number,
        required: true
      },

      installmentsCount: {
        type: Number,
        required: true,
        min: 0
      },

      basePlanNpv: {
        type: Number,
        required: true
      },

      customerPlanNpv: {
        type: Number,
        required: true
      },

      npvDifference: {
        type: Number,
        required: true
      },

      collectedAtHandover: {
        type: Number,
        required: true,
        min: 0
      },

      collectedAtHandoverPct: {
        type: Number,
        required: true,
        min: 0
      },

      totalMaintenance: {
        type: Number,
        default: 0,
        min: 0
      },

      npvPassed: {
        type: Boolean,
        required: true
      },

      collectionPassed: {
        type: Boolean,
        required: true
      },

      accepted: {
        type: Boolean,
        required: true
      }
    },
    {
      _id: false
    }
  );

/* =========================
   Payment Schedule
========================= */

const paymentScheduleItemSchema =
  new Schema<IPaymentScheduleItem>(
    {
      rowId: {
        type: String,
        trim: true
      },

      sortOrder: {
        type: Number
      },

      isInstallment: {
        type: Boolean,
        default: false
      },

      labelSuffix: {
        type: String,
        default: ''
      },

      month: {
        type: Number,
        required: true,
        min: 0
      },

      dueDate: {
        type: Date,
        required: true
      },

      type: {
        type: String,
        required: true,
        enum: [
          'down_payment',
          'installment',
          'milestone',
          'year_end_settlement',
          'handover',
          'addon',
          'maintenance'
        ]
      },

      label: {
        type: String,
        required: true,
        trim: true
      },

      amount: {
        type: Number,
        required: true
      },

      cumulativeAmount: {
        type: Number,
        required: true
      },

      cumulativePct: {
        type: Number,
        required: true
      },

      isHandover: {
        type: Boolean,
        default: false
      }
    },
    {
      _id: false
    }
  );

/* =========================
   Maintenance Schedule
========================= */

const maintenanceScheduleItemSchema =
  new Schema<IMaintenanceScheduleItem>(
    {
      month: {
        type: Number,
        required: true,
        min: 0
      },

      dueDate: {
        type: Date,
        required: true
      },

      amount: {
        type: Number,
        required: true,
        min: 0
      },

      percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
      }
    },
    {
      _id: false
    }
  );

/* =========================
   Offer Schema
========================= */

export const offerSchema = new Schema<IOffer>(
  {
    offerNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },

    projectSnapshot: {
      type: projectSnapshotSchema,
      required: true
    },

    projectPaymentPlan: {
      type: projectPaymentPlanSnapshotSchema
    },

    customer: {
      type: offerCustomerSchema,
      required: true
    },

    salesAgent: {
      type: offerSalesAgentSchema,
      required: true
    },

    unit: {
      type: offerUnitSchema,
      required: true
    },

    contractDate: {
      type: Date,
      required: true
    },

    validUntil: {
      type: Date,
      required: true
    },

    financialInputs: {
      type: financialInputsSchema,
      required: true
    },

    basePlan: {
      type: paymentPlanSchema,
      required: true
    },

    customerPlan: {
      type: paymentPlanSchema,
      required: true
    },

    calculationResult: {
      type: calculationResultSchema,
      required: true
    },

    paymentSchedule: {
      type: [paymentScheduleItemSchema],
      default: []
    },

    maintenanceSchedule: {
      type: [maintenanceScheduleItemSchema],
      default: []
    },

    notes: {
      type: String,
      default: '',
      trim: true
    },

    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'cancelled'
      ],
      default: 'draft',
      index: true
    },

    calculationVersion: {
      type: Number,
      default: 1,
      min: 1
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    approvedAt: {
      type: Date
    },

    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    rejectedAt: {
      type: Date
    },

    rejectionReason: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

/* =========================
   Indexes
========================= */

offerSchema.index({
  project: 1,
  createdAt: -1
});

offerSchema.index({
  'customer.phone': 1
});

offerSchema.index({
  'unit.code': 1
});

offerSchema.index({
  status: 1,
  createdAt: -1
});
