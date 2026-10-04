import { IFinancialPolicy, IProjectPaymentPlan } from "../../utils/common/interfaces";

export interface createDto {
    name: string;

    code: string;
    location: string;

    status: string;
    description: string;

    financialPolicy: IFinancialPolicy;
    paymentPlans: IProjectPaymentPlan[];

}
